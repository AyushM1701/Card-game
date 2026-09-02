// server/RoomManager.js — Room lifecycle & player management

import { v4 as uuidv4 } from 'uuid';

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
    /** @type {Map<string, string>} socketId -> roomCode */
    this.socketToRoom = new Map();
  }

  /**
   * Generate a unique 6-char room code.
   */
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Validate and sanitize player name.
   * @param {string} name
   * @returns {{ valid: boolean, name?: string, error?: string }}
   */
  validateAndSanitizeName(name) {
    if (typeof name !== 'string') {
      return { valid: false, error: 'Player name is required.' };
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: 'Player name cannot be empty.' };
    }
    // Strip HTML tags, control characters and brackets
    const sanitized = trimmed
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x1F\x7F-\x9F<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!sanitized) {
      return { valid: false, error: 'Player name contains invalid characters.' };
    }
    if (sanitized.length > 20) {
      return { valid: false, error: 'Player name must be 20 characters or fewer.' };
    }
    return { valid: true, name: sanitized };
  }

  /**
   * Create a new room.
   * @param {string} hostName
   * @param {string} hostSocketId
   * @param {number} maxPlayers
   * @param {number} totalRounds
   * @returns {Room}
   */
  createRoom(hostName, hostSocketId, maxPlayers = 4, totalRounds = 1) {
    const validated = this.validateAndSanitizeName(hostName);
    if (!validated.valid) {
      throw new Error(validated.error);
    }
    const cleanHostName = validated.name;

    const code = this._generateCode();
    const reconnectToken = uuidv4();
    const host = {
      id: uuidv4(),
      reconnectToken,
      name: cleanHostName,
      socketId: hostSocketId,
      seatIndex: 0,
      connected: true,
      isHost: true,
      isBot: false
    };

    const room = {
      code,
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 10),
      totalRounds: Math.min(Math.max(totalRounds || 1, 1), 10),
      players: [host],
      spectators: [],
      hostId: host.id,
      status: 'waiting', // waiting | playing | finished
      gameState: null,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(hostSocketId, code);
    return room;
  }

  /**
   * Add a bot to a waiting room
   */
  addBot(code, botName) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.status !== 'waiting') return null;
    if (room.players.length >= room.maxPlayers) return null;

    const botPlayer = {
      id: `bot_${uuidv4().substring(0, 8)}`,
      name: botName,
      socketId: null,
      seatIndex: room.players.length,
      connected: true,
      isHost: false,
      isBot: true
    };

    room.players.push(botPlayer);
    return botPlayer;
  }

  /**
   * Remove a bot from a waiting room
   */
  removeBot(code, botId) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.status !== 'waiting') return false;

    const idx = room.players.findIndex(p => p.id === botId && p.isBot);
    if (idx === -1) return false;

    room.players.splice(idx, 1);
    room.players.forEach((p, i) => { p.seatIndex = i; });
    return true;
  }

  /**
   * Join an existing room (as player or spectator).
   * @param {string} code
   * @param {string} playerName
   * @param {string} socketId
   * @param {string} [playerId]
   * @returns {{ success: boolean, room?: Room, player?: object, isSpectator?: boolean, isReconnect?: boolean, error?: string }}
   */
  joinRoom(code, playerName, socketId, playerId = null, reconnectToken = null) {
    const validated = this.validateAndSanitizeName(playerName);
    if (!validated.valid) {
      return { success: false, error: validated.error };
    }
    const cleanPlayerName = validated.name;

    const room = this.rooms.get(code?.toUpperCase());
    if (!room) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    // Check if client is reconnecting to an existing player seat
    if (playerId) {
      const existingPlayer = room.players.find(p => p.id === playerId);
      if (existingPlayer) {
        if (existingPlayer.reconnectToken && reconnectToken && existingPlayer.reconnectToken !== reconnectToken) {
          return { success: false, error: 'Unauthorized reconnection attempt.' };
        }
        existingPlayer.socketId = socketId;
        existingPlayer.connected = true;
        existingPlayer.name = cleanPlayerName;
        delete existingPlayer.disconnectedAt;
        this.socketToRoom.set(socketId, room.code);
        return { success: true, room, player: existingPlayer, isSpectator: false, isReconnect: true };
      }
    }

    // If game is in progress or room is full, join as spectator
    if (room.status === 'playing' || room.players.length >= room.maxPlayers) {
      const spectator = {
        id: playerId || uuidv4(),
        reconnectToken: uuidv4(),
        name: cleanPlayerName,
        socketId,
        connected: true,
        isSpectator: true
      };
      room.spectators.push(spectator);
      this.socketToRoom.set(socketId, room.code);
      return { success: true, room, player: spectator, isSpectator: true };
    }

    // Check for duplicate names among active players
    if (room.players.some(p => p.name.toLowerCase() === cleanPlayerName.toLowerCase())) {
      return { success: false, error: 'That name is already taken in this room.' };
    }

    const player = {
      id: playerId || uuidv4(),
      reconnectToken: uuidv4(),
      name: cleanPlayerName,
      socketId,
      seatIndex: room.players.length,
      connected: true,
      isHost: false,
      isBot: false
    };

    room.players.push(player);
    this.socketToRoom.set(socketId, code);
    return { success: true, room, player, isSpectator: false };
  }

  /**
   * Handle player disconnect. Returns the room and player, or null.
   */
  handleDisconnect(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    // Check spectators
    const specIdx = room.spectators.findIndex(s => s.socketId === socketId);
    if (specIdx !== -1) {
      const spec = room.spectators.splice(specIdx, 1)[0];
      this.socketToRoom.delete(socketId);
      return { room, player: spec, isSpectator: true };
    }

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    player.connected = false;
    player.disconnectedAt = Date.now();
    this.socketToRoom.delete(socketId);

    // If in waiting state, remove the player entirely
    if (room.status === 'waiting') {
      room.players = room.players.filter(p => p.id !== player.id);
      // Re-index seats
      room.players.forEach((p, i) => { p.seatIndex = i; });

      // If host left and there are still human players, transfer host
      if (player.isHost && room.players.length > 0) {
        const nextHuman = room.players.find(p => !p.isBot) || room.players[0];
        nextHuman.isHost = true;
        room.hostId = nextHuman.id;
      }

      // If no human players left, delete room
      const hasHumans = room.players.some(p => !p.isBot);
      if (!hasHumans && room.spectators.length === 0) {
        this.rooms.delete(code);
        return { room: null, player, removed: true, roomCode: code };
      }
    }

    return { room, player, removed: false, roomCode: code };
  }

  /**
   * Attempt to reconnect a player.
   */
  reconnectPlayer(code, playerId, newSocketId, reconnectToken = null) {
    const room = this.rooms.get(code?.toUpperCase());
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      if (player.reconnectToken && reconnectToken && player.reconnectToken !== reconnectToken) {
        return null;
      }
      player.socketId = newSocketId;
      player.connected = true;
      delete player.disconnectedAt;
      this.socketToRoom.set(newSocketId, room.code);
      return { room, player, isSpectator: false };
    }

    const spectator = room.spectators?.find(s => s.id === playerId);
    if (spectator) {
      if (spectator.reconnectToken && reconnectToken && spectator.reconnectToken !== reconnectToken) {
        return null;
      }
      spectator.socketId = newSocketId;
      spectator.connected = true;
      delete spectator.disconnectedAt;
      this.socketToRoom.set(newSocketId, room.code);
      return { room, player: spectator, isSpectator: true };
    }

    return null;
  }

  /**
   * Get room by code.
   */
  getRoom(code) {
    return this.rooms.get(code?.toUpperCase()) || null;
  }

  /**
   * Get room by socket ID.
   */
  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : null;
  }

  /**
   * Get player by socket ID.
   */
  getPlayerBySocket(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    return room.players.find(p => p.socketId === socketId) ||
           room.spectators.find(s => s.socketId === socketId) || null;
  }

  /**
   * Get sanitized player list (no socket IDs exposed to clients).
   */
  getPlayerList(room) {
    return room.players.map(p => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      connected: p.connected,
      isHost: p.isHost,
      isBot: !!p.isBot
    }));
  }

  getSpectatorCount(room) {
    return room.spectators ? room.spectators.length : 0;
  }

  /**
   * Delete a room.
   */
  deleteRoom(code) {
    const cleanCode = code?.toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (room) {
      room.players.forEach(p => {
        if (p.socketId) this.socketToRoom.delete(p.socketId);
      });
      room.spectators.forEach(s => {
        if (s.socketId) this.socketToRoom.delete(s.socketId);
      });
      this.rooms.delete(cleanCode);
    }
  }
}

export default RoomManager;
