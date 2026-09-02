// src/game/ClientState.js — Client-side game state management

class ClientState {
  constructor() {
    this.reset();
    this._listeners = new Map();
  }

  reset() {
    // Room state
    this.roomCode = null;
    this.playerId = null;
    this.playerName = null;
    this.isHost = false;
    this.isSpectator = false;
    this.spectatorCount = 0;
    this.players = [];
    this.maxPlayers = 4;
    this.totalRounds = 1;

    // Game state
    this.phase = null; // 'peek_phase' | 'playing' | 'round_over'
    this.myCards = []; // Array of card objects (known during peek, then memory-only)
    this.knownCards = [null, null, null]; // What we remember / have peeked
    this.playerOrder = [];
    this.currentPlayerId = null;
    this.drawPileCount = 0;
    this.discardPile = [];
    this.drawnCard = null;
    this.roundNumber = 1;
    this.scores = {};
    this.isMatchOver = false;

    // UI state
    this.screen = 'lobby'; // 'lobby' | 'waiting' | 'game' | 'results'
    this.roundResults = null;
    this.pendingAction = null; // { type, triggeredBy? }
    this.peekCards = null; // Cards shown during peek
    this.peekTimerSeconds = 0;
  }

  /**
   * Subscribe to state changes.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
  }

  off(event, handler) {
    const handlers = this._listeners.get(event);
    if (handlers) handlers.delete(handler);
  }

  _emit(event, data) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try { h(data); } catch (e) { console.error(e); }
      });
    }
  }

  // ─── Mutations ──────────────────────────────────────

  setRoom(roomCode, playerId, players, isHost = false, isSpectator = false, totalRounds = 1, reconnectToken = null) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.isHost = isHost;
    this.isSpectator = isSpectator;
    this.players = players || [];
    this.totalRounds = totalRounds || 1;

    const me = this.players.find(p => p.id === playerId);
    if (me) {
      this.playerName = me.name;
    }

    this.screen = isSpectator ? 'game' : 'waiting';
    if (!isSpectator) {
      this.saveSession(roomCode, playerId, reconnectToken);
    }
    this._emit('stateChange', { type: 'room-set' });
  }

  resumeGame(roomCode, playerId, players, isHost = false, isSpectator = false, totalRounds = 1, gameView = null, reconnectToken = null) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.players = players || [];
    this.isHost = isHost;
    this.isSpectator = isSpectator;
    this.totalRounds = totalRounds || 1;

    const me = this.players.find(p => p.id === playerId);
    if (me) {
      this.playerName = me.name;
    }

    if (!isSpectator && reconnectToken) {
      this.saveSession(roomCode, playerId, reconnectToken);
    }

    if (gameView) {
      this.phase = gameView.phase;
      this.drawPileCount = gameView.drawPileCount;
      this.discardPile = gameView.discardPile || [];
      this.currentPlayerId = gameView.currentPlayerId;
      this.playerOrder = gameView.playerOrder || [];
      this.roundNumber = gameView.roundNumber || 1;
      this.scores = gameView.scores || {};
      this.myCards = gameView.myHand || [];
      this.knownCards = (gameView.myHand || []).map(c => (c ? { ...c } : null));
      this.drawnCard = gameView.drawnCard || null;
      this.screen = 'game';
    } else {
      this.screen = isSpectator ? 'game' : 'waiting';
    }

    if (!isSpectator) {
      this.saveSession(roomCode, playerId);
    }

    this._emit('stateChange', { type: 'game-resumed' });
  }

  updatePlayers(players) {
    this.players = players;
    // Check if we're still host
    const me = players.find(p => p.id === this.playerId);
    if (me) this.isHost = me.isHost;
    this._emit('stateChange', { type: 'players-updated' });
  }

  startGame(data) {
    this.phase = data.phase;
    this.myCards = data.myCards || [];
    this.knownCards = (data.myCards || []).map(c => ({ ...c })); // Copy for memory
    this.playerOrder = data.playerOrder || [];
    this.players = data.players || this.players;
    this.drawPileCount = data.drawPileCount;
    this.currentPlayerId = data.currentPlayerId;
    this.roundNumber = data.roundNumber || 1;
    this.totalRounds = data.totalRounds || this.totalRounds || 1;
    if (data.isSpectator !== undefined) this.isSpectator = data.isSpectator;
    if (data.scores) this.scores = { ...data.scores };
    this.screen = 'game';
    this._emit('stateChange', { type: 'game-started' });
  }

  setPeekComplete(currentPlayerId) {
    this.phase = 'playing';
    this.currentPlayerId = currentPlayerId;
    this.peekCards = null;
    this._emit('stateChange', { type: 'peek-complete' });
  }

  setDrawnCard(card) {
    this.drawnCard = card;
    this._emit('stateChange', { type: 'card-drawn' });
  }

  clearDrawnCard() {
    this.drawnCard = null;
    this._emit('stateChange', { type: 'drawn-card-cleared' });
  }

  updateTurn(currentPlayerId, drawPileCount) {
    this.currentPlayerId = currentPlayerId;
    if (drawPileCount !== undefined) this.drawPileCount = drawPileCount;
    this.drawnCard = null;
    this._emit('stateChange', { type: 'turn-changed' });
  }

  updateDrawPile(count) {
    this.drawPileCount = count;
    this._emit('stateChange', { type: 'draw-pile-updated' });
  }

  addToDiscard(card) {
    this.discardPile.push(card);
    this._emit('stateChange', { type: 'discard-updated' });
  }

  updateKnownCard(slotIndex, card) {
    this.knownCards[slotIndex] = card ? { ...card } : null;
    this._emit('stateChange', { type: 'known-card-updated' });
  }

  setAllKnownCards(cards) {
    this.knownCards = (cards || []).map(c => c ? { ...c } : null);
    this._emit('stateChange', { type: 'all-cards-peeked' });
  }

  // After a swap, we know the drawn card is now in the slot
  recordSwap(slotIndex, newCard) {
    this.knownCards[slotIndex] = { ...newCard };
    // Keep myCards in sync so the peek-my-cards overlay shows accurate current hand
    if (this.myCards[slotIndex] !== undefined) {
      this.myCards[slotIndex] = { ...newCard };
    }
    this.drawnCard = null;
    this._emit('stateChange', { type: 'swap-recorded' });
  }

  // After a blind trade, we no longer know what's in that slot
  recordBlindTrade(mySlot) {
    this.knownCards[mySlot] = null; // Unknown now
    this._emit('stateChange', { type: 'trade-recorded' });
  }

  // After a scramble on us, all positions are unknown
  recordScramble() {
    this.knownCards = [null, null, null];
    this._emit('stateChange', { type: 'scramble-recorded' });
  }

  setPendingAction(action) {
    this.pendingAction = action;
    this._emit('stateChange', { type: 'pending-action' });
  }

  clearPendingAction() {
    this.pendingAction = null;
    this._emit('stateChange', { type: 'action-cleared' });
  }

  setRoundResults(data) {
    this.phase = 'round_over';
    this.roundResults = data;
    this.screen = 'results';

    const playerList = Array.isArray(data) ? data : (data.playerResults || []);
    this.isMatchOver = data.isMatchOver !== undefined ? data.isMatchOver : true;
    if (data.totalRounds) this.totalRounds = data.totalRounds;
    if (data.roundNumber) this.roundNumber = data.roundNumber;

    // Update scores
    playerList.forEach(r => {
      this.scores[r.playerId] = r.cumulativeScore;
    });

    if (this.isMatchOver) {
      this.clearSession();
    }

    this._emit('stateChange', { type: 'round-over' });
  }

  /**
   * Helpers
   */
  get isMyTurn() {
    return this.currentPlayerId === this.playerId;
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  getPlayerName(id) {
    const p = this.getPlayerById(id);
    return p ? p.name : 'Unknown';
  }

  get otherPlayers() {
    return this.players.filter(p => p.id !== this.playerId);
  }

  saveSession(roomCode, playerId, reconnectToken = null) {
    if (roomCode && playerId) {
      localStorage.setItem('undercut_room_code', roomCode);
      localStorage.setItem('undercut_player_id', playerId);
      if (reconnectToken) {
        localStorage.setItem('undercut_reconnect_token', reconnectToken);
      }
    }
  }

  clearSession() {
    localStorage.removeItem('undercut_room_code');
    localStorage.removeItem('undercut_player_id');
    localStorage.removeItem('undercut_reconnect_token');
  }

  getSavedSession() {
    const roomCode = localStorage.getItem('undercut_room_code');
    const playerId = localStorage.getItem('undercut_player_id');
    const reconnectToken = localStorage.getItem('undercut_reconnect_token');
    if (roomCode && playerId) {
      return { roomCode, playerId, reconnectToken };
    }
    return null;
  }
}

// Singleton
const clientState = new ClientState();
export default clientState;
