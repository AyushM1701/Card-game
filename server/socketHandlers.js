// server/socketHandlers.js — Socket.IO event handlers

import { isActionCard, getActionType } from './Deck.js';
import botEngine from './BotEngine.js';

/**
 * Wire up all socket events.
 * @param {import('socket.io').Server} io
 * @param {import('./RoomManager.js').default} roomManager
 * @param {import('./GameManager.js').default} gameManager
 */
export default function setupSocketHandlers(io, roomManager, gameManager) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── Room Management ───────────────────────────────────────

    socket.on('create-room', ({ playerName, maxPlayers, totalRounds }, callback) => {
      try {
        const room = roomManager.createRoom(playerName, socket.id, maxPlayers, totalRounds);
        socket.join(room.code);
        const player = room.players[0];
        callback({
          success: true,
          roomCode: room.code,
          playerId: player.id,
          reconnectToken: player.reconnectToken,
          totalRounds: room.totalRounds,
          players: roomManager.getPlayerList(room)
        });
        console.log(`[Room] ${playerName} created room ${room.code} (max ${room.maxPlayers} players, ${room.totalRounds} rounds)`);
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on('add-bot', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) {
        callback?.({ success: false, error: 'Only host can add bots' });
        return;
      }

      const existingNames = room.players.map(p => p.name);
      const botName = botEngine.getRandomName(existingNames);
      const bot = roomManager.addBot(room.code, botName);
      if (!bot) {
        callback?.({ success: false, error: 'Room is full or game started' });
        return;
      }

      io.to(room.code).emit('player-joined', {
        players: roomManager.getPlayerList(room),
        newPlayer: bot
      });

      callback?.({ success: true, bot, players: roomManager.getPlayerList(room) });
    });

    socket.on('remove-bot', ({ botId }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) {
        callback?.({ success: false, error: 'Only host can remove bots' });
        return;
      }

      const success = roomManager.removeBot(room.code, botId);
      if (success) {
        io.to(room.code).emit('player-joined', {
          players: roomManager.getPlayerList(room)
        });
      }
      callback?.({ success, players: roomManager.getPlayerList(room) });
    });

    socket.on('join-room', ({ roomCode, playerName, playerId, reconnectToken }, callback) => {
      const result = roomManager.joinRoom(roomCode, playerName, socket.id, playerId, reconnectToken);
      if (!result.success) {
        callback({ success: false, error: result.error });
        return;
      }
      socket.join(result.room.code);

      const game = gameManager.getGame(result.room.code);
      if (result.isReconnect && game?.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
      }

      let gameView = null;
      if (game && result.room.status === 'playing' && !result.isSpectator) {
        gameView = gameManager.getPlayerView(result.room.code, result.player.id);
      }

      callback({
        success: true,
        roomCode: result.room.code,
        playerId: result.player.id,
        reconnectToken: result.player.reconnectToken,
        isHost: !!result.player.isHost,
        isSpectator: !!result.isSpectator,
        status: result.room.status,
        totalRounds: result.room.totalRounds,
        spectatorCount: roomManager.getSpectatorCount(result.room),
        players: roomManager.getPlayerList(result.room),
        gameView
      });

      if (result.isReconnect) {
        io.to(result.room.code).emit('player-joined', {
          players: roomManager.getPlayerList(result.room)
        });
      } else if (result.isSpectator) {
        // If joining as spectator to active game, send current game view
        if (game) {
          socket.emit('spectator-game-sync', {
            phase: game.phase,
            roundNumber: game.roundNumber,
            totalRounds: game.totalRounds,
            players: roomManager.getPlayerList(result.room),
            drawPileCount: game.drawPile.length,
            discardPile: game.discardPile.slice(-1),
            currentPlayerId: gameManager.getCurrentPlayerId(result.room.code)
          });
        }
        io.to(result.room.code).emit('spectator-count-update', {
          count: roomManager.getSpectatorCount(result.room)
        });
      } else {
        // Notify all others in the room
        socket.to(result.room.code).emit('player-joined', {
          players: roomManager.getPlayerList(result.room),
          newPlayer: {
            id: result.player.id,
            name: result.player.name,
            seatIndex: result.player.seatIndex,
            isBot: false
          }
        });
      }

      console.log(`[Room] ${playerName} joined room ${result.room.code} (${result.isSpectator ? 'Spectator' : (result.isReconnect ? 'Reconnected Player' : 'Player')})`);
    });

    socket.on('reconnect-room', ({ roomCode, playerId, reconnectToken }, callback) => {
      if (!roomCode || !playerId) {
        callback?.({ success: false, error: 'Missing roomCode or playerId' });
        return;
      }

      const result = roomManager.reconnectPlayer(roomCode, playerId, socket.id, reconnectToken);
      if (!result) {
        callback?.({ success: false, error: 'Could not reconnect to room. Invalid credentials or expired session.' });
        return;
      }

      const { room, player, isSpectator } = result;
      socket.join(room.code);

      const game = gameManager.getGame(room.code);
      if (game?.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
      }

      let gameView = null;
      if (game && room.status === 'playing' && !isSpectator) {
        gameView = gameManager.getPlayerView(room.code, player.id);
      }

      callback?.({
        success: true,
        roomCode: room.code,
        playerId: player.id,
        playerName: player.name,
        reconnectToken: player.reconnectToken,
        isHost: !!player.isHost,
        isSpectator: !!isSpectator,
        status: room.status,
        totalRounds: room.totalRounds,
        spectatorCount: roomManager.getSpectatorCount(room),
        players: roomManager.getPlayerList(room),
        gameView
      });

      if (isSpectator && game) {
        socket.emit('spectator-game-sync', {
          phase: game.phase,
          roundNumber: game.roundNumber,
          totalRounds: game.totalRounds,
          players: roomManager.getPlayerList(room),
          drawPileCount: game.drawPile.length,
          discardPile: game.discardPile.slice(-1),
          currentPlayerId: gameManager.getCurrentPlayerId(room.code)
        });
      }

      io.to(room.code).emit('player-joined', {
        players: roomManager.getPlayerList(room)
      });

      console.log(`[Room] ${player.name} reconnected to room ${room.code} (status: ${room.status})`);
    });

    // ─── Game Start ────────────────────────────────────────────

    socket.on('start-game', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }
      if (!player.isHost) {
        callback?.({ success: false, error: 'Only the host can start the game' });
        return;
      }
      if (room.players.length < 2) {
        callback?.({ success: false, error: 'Need at least 2 players (add bots if playing solo!)' });
        return;
      }

      room.status = 'playing';
      const gameState = gameManager.startGame(room);
      room.gameState = gameState;

      // Initialize bot memory
      botEngine.initRoom(room.code, gameState);

      // Auto-mark peek done for bots
      for (const p of room.players) {
        if (p.isBot) {
          gameManager.markPeekDone(room.code, p.id);
        }
      }

      // Send each human player their own cards for the peek phase
      for (const p of room.players) {
        if (!p.isBot && p.socketId) {
          const hand = gameState.hands[p.id];
          io.to(p.socketId).emit('game-started', {
            phase: 'peek_phase',
            myCards: hand.cards.map(c => ({ ...c })),
            playerOrder: gameState.playerOrder,
            players: roomManager.getPlayerList(room),
            drawPileCount: gameState.drawPile.length,
            roundNumber: gameState.roundNumber,
            totalRounds: gameState.totalRounds,
            currentPlayerId: gameState.playerOrder[gameState.currentPlayerIndex]
          });
        }
      }

      // Notify spectators
      for (const spec of room.spectators) {
        if (spec.socketId) {
          io.to(spec.socketId).emit('game-started', {
            phase: 'peek_phase',
            myCards: [],
            isSpectator: true,
            playerOrder: gameState.playerOrder,
            players: roomManager.getPlayerList(room),
            drawPileCount: gameState.drawPile.length,
            roundNumber: gameState.roundNumber,
            totalRounds: gameState.totalRounds,
            currentPlayerId: gameState.playerOrder[gameState.currentPlayerIndex]
          });
        }
      }

      callback?.({ success: true });
      console.log(`[Game] Game started in room ${room.code} with ${room.players.length} players (${gameState.totalRounds} rounds)`);
    });

    // ─── Start Next Round (Multi-round match) ──────────────────

    socket.on('start-next-round', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) {
        callback?.({ success: false, error: 'Only host can start next round' });
        return;
      }

      const gameState = gameManager.startNextRound(room);
      if (!gameState) {
        callback?.({ success: false, error: 'Could not start next round' });
        return;
      }

      botEngine.initRoom(room.code, gameState);

      // Auto-mark peek done for bots
      for (const p of room.players) {
        if (p.isBot) {
          gameManager.markPeekDone(room.code, p.id);
        }
      }

      for (const p of room.players) {
        if (!p.isBot && p.socketId) {
          const hand = gameState.hands[p.id];
          io.to(p.socketId).emit('game-started', {
            phase: 'peek_phase',
            myCards: hand.cards.map(c => ({ ...c })),
            playerOrder: gameState.playerOrder,
            players: roomManager.getPlayerList(room),
            drawPileCount: gameState.drawPile.length,
            roundNumber: gameState.roundNumber,
            totalRounds: gameState.totalRounds,
            scores: { ...gameState.scores },
            currentPlayerId: gameState.playerOrder[gameState.currentPlayerIndex]
          });
        }
      }

      for (const spec of room.spectators) {
        if (spec.socketId) {
          io.to(spec.socketId).emit('game-started', {
            phase: 'peek_phase',
            myCards: [],
            isSpectator: true,
            playerOrder: gameState.playerOrder,
            players: roomManager.getPlayerList(room),
            drawPileCount: gameState.drawPile.length,
            roundNumber: gameState.roundNumber,
            totalRounds: gameState.totalRounds,
            scores: { ...gameState.scores },
            currentPlayerId: gameState.playerOrder[gameState.currentPlayerIndex]
          });
        }
      }

      callback?.({ success: true });
    });

    // ─── Peek Phase ────────────────────────────────────────────

    socket.on('peek-done', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      const allDone = gameManager.markPeekDone(room.code, player.id);

      if (allDone) {
        const startPid = gameManager.getCurrentPlayerId(room.code);
        io.to(room.code).emit('peek-phase-complete', {
          currentPlayerId: startPid
        });
        console.log(`[Game] Peek phase complete in room ${room.code}`);

        const startingPlayer = room.players.find(p => p.id === startPid);
        if (startingPlayer && startingPlayer.isBot) {
          botEngine.processBotTurn(room.code, startPid, gameManager, roomManager, io, (ioInstance, code, gmMgr) => {
            emitTurnChange(ioInstance, code, gmMgr, roomManager);
          });
        }
      }
    });

    // ─── Draw Card ─────────────────────────────────────────────

    socket.on('draw-card', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const result = gameManager.drawCard(room.code, player.id);
      if (!result) {
        // Could be round over
        const game = gameManager.getGame(room.code);
        if (game && game.phase === 'round_over') {
          if (!game.roundOverEmitted) {
            game.roundOverEmitted = true;
            const results = gameManager.getRoundResults(room.code);
            io.to(room.code).emit('round-over', { results });
          }
          callback?.({ success: false, roundOver: true });
        } else {
          callback?.({ success: false, error: 'Cannot draw right now' });
        }
        return;
      }

      // Send the drawn card privately to the drawing player
      callback?.({
        success: true,
        card: result.card,
        isAction: isActionCard(result.card),
        actionType: isActionCard(result.card) ? getActionType(result.card) : null
      });

      // Notify others that a card was drawn (no card details)
      socket.to(room.code).emit('player-drew-card', {
        playerId: player.id,
        drawPileCount: result.pileCount
      });

      // Update draw pile count for all
      io.to(room.code).emit('draw-pile-update', { count: result.pileCount });
    });

    // ─── Swap Card ─────────────────────────────────────────────

    socket.on('swap-card', ({ slotIndex }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      const parsedSlot = parseInt(slotIndex, 10);
      if (Number.isNaN(parsedSlot) || parsedSlot < 0 || parsedSlot > 2) {
        callback?.({ success: false, error: 'Invalid slot index (must be 0, 1, or 2)' });
        return;
      }

      const result = gameManager.swapCard(room.code, player.id, parsedSlot);
      if (!result.success) {
        callback?.({ success: false, error: result.error });
        return;
      }

      callback?.({
        success: true,
        displaced: result.displaced,
        actionTriggered: result.actionTriggered
      });

      // Notify others
      socket.to(room.code).emit('player-swapped', {
        playerId: player.id,
        slotIndex: parsedSlot,
        discardedCard: result.displaced  // Displaced card goes to discard (visible)
      });

      // If no action triggered, emit turn change
      if (!result.actionTriggered) {
        emitTurnChange(io, room.code, gameManager, roomManager);
      } else {
        // Start action resolution timeout (30s) to prevent stalling on open action modal
        const game = gameManager.getGame(room.code);
        if (game) {
          if (game.turnTimer) clearTimeout(game.turnTimer);
          game.turnTimer = setTimeout(() => {
            const g = gameManager.getGame(room.code);
            if (g && g.pendingAction && g.pendingAction.playerId === player.id) {
              console.log(`[Game] Timing out pending action for player ${player.name} in room ${room.code}`);
              gameManager.finishActionAndAdvance(room.code);
              io.to(room.code).emit('player-skipped', {
                playerId: player.id,
                playerName: player.name,
                reason: 'Action resolution timeout'
              });
              emitTurnChange(io, room.code, gameManager, roomManager);
            }
          }, 30000);
        }
      }
    });

    // ─── Discard Drawn Card ────────────────────────────────────

    socket.on('discard-drawn', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      const game = gameManager.getGame(room.code);
      const discardedCard = game?.drawnCard ? { ...game.drawnCard } : null;

      const success = gameManager.discardDrawn(room.code, player.id);
      callback?.({ success });

      if (success) {
        // Notify others
        io.to(room.code).emit('player-discarded', {
          playerId: player.id,
          card: discardedCard
        });

        emitTurnChange(io, room.code, gameManager, roomManager);
      }
    });

    // ─── Play Action Card Immediately ──────────────────────────

    socket.on('play-action-immediately', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      const result = gameManager.playActionImmediately(room.code, player.id);
      callback?.({
        success: result.success,
        actionType: result.actionType,
        error: result.error
      });

      if (result.success) {
        socket.to(room.code).emit('player-played-action', {
          playerId: player.id,
          actionType: result.actionType
        });

        // Start action resolution timeout (30s) to prevent stalling on open action modal
        const game = gameManager.getGame(room.code);
        if (game) {
          if (game.turnTimer) clearTimeout(game.turnTimer);
          game.turnTimer = setTimeout(() => {
            const g = gameManager.getGame(room.code);
            if (g && g.pendingAction && g.pendingAction.playerId === player.id) {
              console.log(`[Game] Timing out pending action for player ${player.name} in room ${room.code}`);
              gameManager.finishActionAndAdvance(room.code);
              io.to(room.code).emit('player-skipped', {
                playerId: player.id,
                playerName: player.name,
                reason: 'Action resolution timeout'
              });
              emitTurnChange(io, room.code, gameManager, roomManager);
            }
          }, 30000);
        }
      }
    });

    // ─── Action Card Resolutions ───────────────────────────────

    // King — Peek Own
    socket.on('resolve-peek-own', (_, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const game = gameManager.getGame(room.code);
      const auth = _canResolveAction(game, player.id, 'peek-own');
      if (!auth.allowed) {
        callback?.({ success: false, error: auth.error });
        return;
      }

      const cards = gameManager.resolvePeekOwn(room.code, player.id);
      if (!cards) {
        callback?.({ success: false, error: 'Failed to resolve peek own' });
        return;
      }

      callback?.({ success: true, cards });

      gameManager.finishActionAndAdvance(room.code);
      emitTurnChange(io, room.code, gameManager, roomManager);
    });

    // Queen — Peek Opponent
    socket.on('resolve-peek-opponent', ({ targetPlayerId }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const game = gameManager.getGame(room.code);
      const auth = _canResolveAction(game, player.id, 'peek-opponent');
      if (!auth.allowed) {
        callback?.({ success: false, error: auth.error });
        return;
      }

      const cards = gameManager.resolvePeekOpponent(room.code, player.id, targetPlayerId);
      if (!cards) {
        callback?.({ success: false, error: 'Failed to resolve peek opponent' });
        return;
      }

      callback?.({ success: true, cards });

      // Notify the target they were peeked at
      const targetPlayer = room.players.find(p => p.id === targetPlayerId);
      if (targetPlayer && targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('you-were-peeked', {
          byPlayerId: player.id
        });
      }

      gameManager.finishActionAndAdvance(room.code);
      emitTurnChange(io, room.code, gameManager, roomManager);
    });

    // Jack — Blind Trade
    socket.on('resolve-blind-trade', ({ mySlot, targetPlayerId, targetSlot }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const myParsed = parseInt(mySlot, 10);
      const targetParsed = parseInt(targetSlot, 10);
      if (Number.isNaN(myParsed) || myParsed < 0 || myParsed > 2 ||
          Number.isNaN(targetParsed) || targetParsed < 0 || targetParsed > 2) {
        callback?.({ success: false, error: 'Invalid slot index (must be 0, 1, or 2)' });
        return;
      }

      const game = gameManager.getGame(room.code);
      const auth = _canResolveAction(game, player.id, 'blind-trade');
      if (!auth.allowed) {
        callback?.({ success: false, error: auth.error });
        return;
      }

      const success = gameManager.resolveBlindTrade(room.code, player.id, myParsed, targetPlayerId, targetParsed);
      if (!success) {
        callback?.({ success: false, error: 'Failed to resolve blind trade' });
        return;
      }

      botEngine.updateMemorySlot(room.code, player.id, myParsed, null);
      botEngine.updateMemorySlot(room.code, targetPlayerId, targetParsed, null);

      callback?.({ success: true });

      io.to(room.code).emit('blind-trade-complete', {
        playerId: player.id,
        mySlot: myParsed,
        targetPlayerId,
        targetSlot: targetParsed
      });

      gameManager.finishActionAndAdvance(room.code);
      emitTurnChange(io, room.code, gameManager, roomManager);
    });

    // Seven — Scramble
    socket.on('resolve-scramble', ({ targetPlayerId }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const game = gameManager.getGame(room.code);
      const auth = _canResolveAction(game, player.id, 'scramble');
      if (!auth.allowed) {
        callback?.({ success: false, error: auth.error });
        return;
      }

      const success = gameManager.resolveScramble(room.code, player.id, targetPlayerId);
      if (!success) {
        callback?.({ success: false, error: 'Failed to resolve scramble' });
        return;
      }

      botEngine.scrambleMemory(room.code, targetPlayerId);

      callback?.({ success: true });

      io.to(room.code).emit('cards-scrambled', {
        playerId: player.id,
        targetPlayerId
      });

      gameManager.finishActionAndAdvance(room.code);
      emitTurnChange(io, room.code, gameManager, roomManager);
    });

    // ─── Action triggered from swap (displaced card) ───────────
    socket.on('resolve-triggered-action', ({ actionType, targetPlayerId, mySlot, targetSlot }, callback) => {
      const room = roomManager.getRoomBySocket(socket.id);
      const player = roomManager.getPlayerBySocket(socket.id);
      if (!room || !player) {
        callback?.({ success: false, error: 'Not in a room' });
        return;
      }

      const VALID_ACTIONS = new Set(['peek-own', 'peek-opponent', 'blind-trade', 'scramble']);
      if (!VALID_ACTIONS.has(actionType)) {
        callback?.({ success: false, error: `Invalid action type: ${actionType}` });
        return;
      }

      const game = gameManager.getGame(room.code);
      const auth = _canResolveAction(game, player.id, actionType);
      if (!auth.allowed) {
        callback?.({ success: false, error: auth.error });
        return;
      }

      let success = false;
      let data = {};

      switch (actionType) {
        case 'peek-own': {
          const cards = gameManager.resolvePeekOwn(room.code, player.id);
          success = !!cards;
          data = { cards };
          break;
        }
        case 'peek-opponent': {
          const cards = gameManager.resolvePeekOpponent(room.code, player.id, targetPlayerId);
          success = !!cards;
          data = { cards };
          if (success) {
            const target = room.players.find(p => p.id === targetPlayerId);
            if (target && target.socketId) {
              io.to(target.socketId).emit('you-were-peeked', {
                byPlayerId: player.id
              });
            }
          }
          break;
        }
        case 'blind-trade': {
          const myParsed = parseInt(mySlot, 10);
          const targetParsed = parseInt(targetSlot, 10);
          if (Number.isNaN(myParsed) || myParsed < 0 || myParsed > 2 ||
              Number.isNaN(targetParsed) || targetParsed < 0 || targetParsed > 2) {
            callback?.({ success: false, error: 'Invalid slot index (must be 0, 1, or 2)' });
            return;
          }
          success = gameManager.resolveBlindTrade(room.code, player.id, myParsed, targetPlayerId, targetParsed);
          if (success) {
            botEngine.updateMemorySlot(room.code, player.id, myParsed, null);
            botEngine.updateMemorySlot(room.code, targetPlayerId, targetParsed, null);
            io.to(room.code).emit('blind-trade-complete', {
              playerId: player.id,
              mySlot: myParsed,
              targetPlayerId,
              targetSlot: targetParsed
            });
          }
          break;
        }
        case 'scramble': {
          success = gameManager.resolveScramble(room.code, player.id, targetPlayerId);
          if (success) {
            botEngine.scrambleMemory(room.code, targetPlayerId);
            io.to(room.code).emit('cards-scrambled', {
              playerId: player.id,
              targetPlayerId
            });
          }
          break;
        }
        default: {
          callback?.({ success: false, error: `Unknown action type: ${actionType}` });
          return;
        }
      }

      if (!success) {
        callback?.({ success: false, error: 'Failed to resolve action' });
        return;
      }

      callback?.({ success: true, ...data });

      gameManager.finishActionAndAdvance(room.code);
      emitTurnChange(io, room.code, gameManager, roomManager);
    });

    // ─── Disconnect ────────────────────────────────────────────

    socket.on('disconnect', () => {
      const result = roomManager.handleDisconnect(socket.id);
      if (result) {
        if (result.removed && result.roomCode) {
          gameManager.removeGame(result.roomCode);
          console.log(`[Room] Room ${result.roomCode} removed and game state cleared (no human players left)`);
        } else if (result.room) {
          io.to(result.room.code).emit('player-disconnected', {
            playerId: result.player.id,
            playerName: result.player.name,
            players: roomManager.getPlayerList(result.room)
          });
          console.log(`[Socket] ${result.player.name} disconnected from room ${result.room.code}`);

          // If game is active and it is currently the disconnected player's turn, trigger grace-period auto-skip
          const game = gameManager.getGame(result.room.code);
          if (game && result.room.status === 'playing') {
            const currentPid = game.playerOrder[game.currentPlayerIndex];
            if (currentPid === result.player.id && !game.turnTimer) {
              emitTurnChange(io, result.room.code, gameManager, roomManager);
            }
          }
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}

/**
 * Shared validation step to authorize action resolution.
 * Verifies:
 *  1. game exists
 *  2. game.pendingAction exists
 *  3. game.pendingAction.playerId === playerId
 *  4. game.pendingAction.type matches expected action type
 * @param {object} game
 * @param {string} playerId
 * @param {string} [expectedType]
 * @returns {{ allowed: boolean, error?: string }}
 */
function _canResolveAction(game, playerId, expectedType) {
  if (!game) {
    return { allowed: false, error: 'Game not found' };
  }
  if (!game.pendingAction) {
    return { allowed: false, error: 'No pending action to resolve' };
  }
  if (game.pendingAction.playerId !== playerId) {
    return { allowed: false, error: 'You are not authorized to resolve this action' };
  }
  if (expectedType && game.pendingAction.type !== expectedType) {
    return { allowed: false, error: `Action type mismatch: expected ${game.pendingAction.type}, got ${expectedType}` };
  }
  return { allowed: true };
}

/**
 * Emit turn change to all players in a room.
 */
function emitTurnChange(io, roomCode, gameManager, roomManager) {
  const game = gameManager.getGame(roomCode);
  const room = roomManager?.getRoom(roomCode);
  if (!game) return;

  // Clear any existing turn timer
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }

  if (game.phase === 'round_over') {
    if (!game.roundOverEmitted) {
      game.roundOverEmitted = true;
      const results = gameManager.getRoundResults(roomCode);
      io.to(roomCode).emit('round-over', { results });
    }
  } else {
    const currentPid = game.playerOrder[game.currentPlayerIndex];
    io.to(roomCode).emit('turn-change', {
      currentPlayerId: currentPid,
      drawPileCount: game.drawPile.length
    });

    const currentPlayer = room?.players.find(p => p.id === currentPid);
    if (!currentPlayer) return;

    if (currentPlayer.isBot) {
      botEngine.processBotTurn(roomCode, currentPid, gameManager, roomManager, io, (ioInstance, code, gmMgr) => {
        emitTurnChange(ioInstance, code, gmMgr, roomManager);
      });
    } else if (!currentPlayer.connected) {
      // Human player is currently disconnected — start grace period timer
      const gracePeriodMs = 6000;
      io.to(roomCode).emit('turn-timer-warning', {
        playerId: currentPid,
        playerName: currentPlayer.name,
        seconds: Math.round(gracePeriodMs / 1000)
      });

      game.turnTimer = setTimeout(() => {
        game.turnTimer = null;
        const activeGame = gameManager.getGame(roomCode);
        const activeRoom = roomManager?.getRoom(roomCode);
        if (!activeGame || !activeRoom || activeGame.phase !== 'playing') return;

        const nowPid = activeGame.playerOrder[activeGame.currentPlayerIndex];
        if (nowPid !== currentPid) return;

        const p = activeRoom.players.find(pl => pl.id === currentPid);
        if (p && p.connected) return;

        // Check if ANY human players or spectators remain connected in the room
        const hasConnectedHumans = activeRoom.players.some(pl => !pl.isBot && pl.connected) || (activeRoom.spectators && activeRoom.spectators.length > 0);
        if (!hasConnectedHumans) {
          console.log(`[Game] All human players disconnected in room ${roomCode} — tearing down abandoned room and game`);
          gameManager.removeGame(roomCode);
          roomManager.deleteRoom(roomCode);
          return;
        }

        console.log(`[Game] Auto-skipping disconnected player ${currentPlayer.name} (${currentPid}) in room ${roomCode}`);

        // If player has a pending action awaiting resolution, finish it directly without drawing an extra card
        if (activeGame.pendingAction) {
          gameManager.finishActionAndAdvance(roomCode);
        } else if (activeGame.drawnCard) {
          const discarded = { ...activeGame.drawnCard };
          gameManager.discardDrawn(roomCode, currentPid);
          io.to(roomCode).emit('player-discarded', {
            playerId: currentPid,
            card: discarded
          });
        } else {
          const drawRes = gameManager.drawCard(roomCode, currentPid);
          if (drawRes) {
            io.to(roomCode).emit('player-drew-card', {
              playerId: currentPid,
              drawPileCount: drawRes.pileCount
            });
            io.to(roomCode).emit('draw-pile-update', { count: drawRes.pileCount });
            gameManager.discardDrawn(roomCode, currentPid);
            io.to(roomCode).emit('player-discarded', {
              playerId: currentPid,
              card: drawRes.card
            });
          } else {
            // Draw pile was empty or end of round reached
            gameManager.finishActionAndAdvance(roomCode);
          }
        }

        io.to(roomCode).emit('player-skipped', {
          playerId: currentPid,
          playerName: currentPlayer.name,
          reason: 'Disconnected'
        });

        emitTurnChange(io, roomCode, gameManager, roomManager);
      }, gracePeriodMs);
    } else {
      // Connected human player — idle turn stall protection (45s timeout)
      const idleTimeoutMs = 45000;
      game.turnTimer = setTimeout(() => {
        game.turnTimer = null;
        const activeGame = gameManager.getGame(roomCode);
        const activeRoom = roomManager?.getRoom(roomCode);
        if (!activeGame || !activeRoom || activeGame.phase !== 'playing') return;

        const nowPid = activeGame.playerOrder[activeGame.currentPlayerIndex];
        if (nowPid !== currentPid) return;

        console.log(`[Game] Auto-skipping idle/unresponsive player ${currentPlayer.name} (${currentPid}) in room ${roomCode}`);

        if (activeGame.pendingAction) {
          gameManager.finishActionAndAdvance(roomCode);
        } else if (activeGame.drawnCard) {
          const discarded = { ...activeGame.drawnCard };
          gameManager.discardDrawn(roomCode, currentPid);
          io.to(roomCode).emit('player-discarded', {
            playerId: currentPid,
            card: discarded
          });
        } else {
          const drawRes = gameManager.drawCard(roomCode, currentPid);
          if (drawRes) {
            io.to(roomCode).emit('player-drew-card', {
              playerId: currentPid,
              drawPileCount: drawRes.pileCount
            });
            io.to(roomCode).emit('draw-pile-update', { count: drawRes.pileCount });
            gameManager.discardDrawn(roomCode, currentPid);
            io.to(roomCode).emit('player-discarded', {
              playerId: currentPid,
              card: drawRes.card
            });
          } else {
            gameManager.finishActionAndAdvance(roomCode);
          }
        }

        io.to(roomCode).emit('player-skipped', {
          playerId: currentPid,
          playerName: currentPlayer.name,
          reason: 'Turn timeout'
        });

        emitTurnChange(io, roomCode, gameManager, roomManager);
      }, idleTimeoutMs);
    }
  }
}
