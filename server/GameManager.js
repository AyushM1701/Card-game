// server/GameManager.js — Game state machine & Undercut rules engine

import { createDeck, shuffle, draw, isActionCard, getActionType, getCardValue } from './Deck.js';

/**
 * Game phases:
 *  PEEK_PHASE  — Players look at their 3 dealt cards
 *  PLAYING     — Active gameplay, turns rotate clockwise
 *  ROUND_OVER  — Draw pile exhausted, reveal & score
 */
const PHASE = {
  PEEK_PHASE: 'peek_phase',
  PLAYING: 'playing',
  ROUND_OVER: 'round_over'
};

class GameManager {
  constructor() {
    /** @type {Map<string, GameState>} roomCode -> gameState */
    this.games = new Map();
  }

  /**
   * Private helper to build a shuffled deck and deal 3 cards to each player.
   * @param {object} room
   * @returns {{ deck: Array, hands: object }}
   * @private
   */
  _dealHands(room) {
    const numDecks = room.players.length >= 5 ? 2 : 1;
    const deck = shuffle(createDeck(numDecks));

    const hands = {};
    for (const player of room.players) {
      hands[player.id] = {
        cards: [deck.pop(), deck.pop(), deck.pop()],
        isBot: !!player.isBot
      };
    }
    return { deck, hands };
  }

  /**
   * Initialize a new game for a room.
   * @param {object} room — The room object from RoomManager
   * @returns {GameState}
   */
  startGame(room) {
    const { deck, hands } = this._dealHands(room);

    const state = {
      roomCode: room.code,
      phase: PHASE.PEEK_PHASE,
      drawPile: deck,
      discardPile: [],
      hands,
      playerOrder: room.players.map(p => p.id),
      currentPlayerIndex: 0,
      drawnCard: null,        // The card the current player has drawn (held in hand, not yet placed)
      drawnByPlayerId: null,  // Who drew it
      peeksDone: new Set(),   // Player IDs who have finished peeking
      pendingAction: null,    // { type, playerId, isTriggered } | null
      turnTimer: null,
      roundNumber: 1,
      totalRounds: room.totalRounds || 1,
      scores: {},  // playerId -> cumulative score across rounds
      roundHistory: [], // [{ roundNumber, results }]
      roundOverEmitted: false
    };

    // Initialize scores
    for (const player of room.players) {
      state.scores[player.id] = 0;
    }

    this.games.set(room.code, state);
    return state;
  }

  /**
   * Start next round in a multi-round match
   */
  startNextRound(room) {
    const game = this.games.get(room.code);
    if (!game) return null;

    const { deck, hands } = this._dealHands(room);

    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    game.phase = PHASE.PEEK_PHASE;
    game.drawPile = deck;
    game.discardPile = [];
    game.hands = hands;
    game.currentPlayerIndex = 0;
    game.drawnCard = null;
    game.drawnByPlayerId = null;
    game.peeksDone = new Set();
    game.pendingAction = null;
    game.roundNumber += 1;
    game.roundOverEmitted = false;

    return game;
  }

  isMatchOver(roomCode) {
    const game = this.games.get(roomCode);
    if (!game) return true;
    return game.roundNumber >= game.totalRounds;
  }

  /**
   * Get game state for a room.
   */
  getGame(roomCode) {
    return this.games.get(roomCode) || null;
  }

  /**
   * Mark a player as done peeking.
   * @returns {boolean} true if all players have finished peeking
   */
  markPeekDone(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PEEK_PHASE) return false;

    game.peeksDone.add(playerId);

    if (game.peeksDone.size >= game.playerOrder.length) {
      game.phase = PHASE.PLAYING;
      return true; // All peeked — game starts
    }
    return false;
  }

  /**
   * Get the current player's ID.
   */
  getCurrentPlayerId(roomCode) {
    const game = this.games.get(roomCode);
    if (!game) return null;
    return game.playerOrder[game.currentPlayerIndex];
  }

  /**
   * Draw a card from the draw pile.
   * @returns {{ card: object, pileCount: number } | null}
   */
  drawCard(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return null;
    if (this.getCurrentPlayerId(roomCode) !== playerId) return null;
    if (game.drawnCard) return null; // Already holding a drawn card

    const card = draw(game.drawPile);
    if (!card) {
      // Draw pile exhausted — end round
      this._endRound(roomCode);
      return null;
    }

    game.drawnCard = card;
    game.drawnByPlayerId = playerId;

    return {
      card,
      pileCount: game.drawPile.length
    };
  }

  /**
   * Swap the drawn card into a hand slot.
   * Any card (plain or action) can replace any slot — no value restriction.
   * @returns {{ success: boolean, displaced?: object, actionTriggered?: string, error?: string }}
   */
  swapCard(roomCode, playerId, slotIndex) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return { success: false, error: 'Not in play phase' };
    if (game.drawnByPlayerId !== playerId) return { success: false, error: 'Not your drawn card' };
    if (!game.drawnCard) return { success: false, error: 'No card drawn' };
    if (slotIndex < 0 || slotIndex > 2) return { success: false, error: 'Invalid slot' };

    const hand = game.hands[playerId];
    const drawnCard = game.drawnCard;
    const slotCard = hand.cards[slotIndex];
    const isDrawnAction = isActionCard(drawnCard);

    // No value restriction — any card can replace any slot (high-risk mechanic)

    // Perform the swap
    hand.cards[slotIndex] = drawnCard;

    // Discard the displaced card
    game.discardPile.push(slotCard);

    // Check if displaced card triggers an action
    let actionTriggered = null;
    if (isActionCard(slotCard)) {
      // The displaced action card triggers
      actionTriggered = getActionType(slotCard);
    }

    game.drawnCard = null;
    game.drawnByPlayerId = null;

    // If an action was triggered, set pendingAction; otherwise advance turn
    if (actionTriggered) {
      game.pendingAction = {
        type: actionTriggered,
        playerId,
        isTriggered: true
      };
    } else {
      game.pendingAction = null;
      this._advanceTurn(roomCode);
    }

    return {
      success: true,
      displaced: slotCard,
      actionTriggered,
      pileCount: game.drawPile.length
    };
  }

  /**
   * Discard the drawn card without swapping.
   */
  discardDrawn(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return false;
    if (game.drawnByPlayerId !== playerId) return false;
    if (!game.drawnCard) return false;

    game.discardPile.push(game.drawnCard);
    game.drawnCard = null;
    game.drawnByPlayerId = null;
    game.pendingAction = null;

    this._advanceTurn(roomCode);
    return true;
  }

  /**
   * Play an action card immediately (drawn action card played without banking).
   * The action card is discarded after use.
   * @returns {{ success: boolean, error?: string }}
   */
  playActionImmediately(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return { success: false, error: 'Not in play phase' };
    if (game.drawnByPlayerId !== playerId) return { success: false, error: 'Not your drawn card' };
    if (!game.drawnCard || !isActionCard(game.drawnCard)) {
      return { success: false, error: 'No action card drawn' };
    }

    const actionType = getActionType(game.drawnCard);
    game.discardPile.push(game.drawnCard);
    game.drawnCard = null;
    game.drawnByPlayerId = null;

    game.pendingAction = {
      type: actionType,
      playerId,
      isTriggered: false
    };

    // The action will be resolved by the socket handler after getting target info
    return { success: true, actionType };
  }

  /**
   * Resolve King — Peek Own: returns the player's own 3 cards.
   */
  resolvePeekOwn(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return null;
    const hand = game.hands[playerId];
    if (!hand) return null;
    game.pendingAction = null;
    return hand.cards.map(c => ({ ...c }));
  }

  /**
   * Resolve Queen — Peek Opponent: returns all 3 cards of an opponent.
   * @param {string} targetPlayerId
   */
  resolvePeekOpponent(roomCode, playerId, targetPlayerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return null;
    if (targetPlayerId === playerId) return null;
    const targetHand = game.hands[targetPlayerId];
    if (!targetHand) return null;
    game.pendingAction = null;
    return targetHand.cards.map(c => ({ ...c }));
  }

  /**
   * Resolve Jack — Blind Trade: swap one of your cards with one of an opponent's, neither looks.
   */
  resolveBlindTrade(roomCode, playerId, mySlot, targetPlayerId, targetSlot) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return false;
    if (targetPlayerId === playerId) return false;

    const myHand = game.hands[playerId];
    const targetHand = game.hands[targetPlayerId];
    if (!myHand || !targetHand) return false;
    if (mySlot < 0 || mySlot > 2 || targetSlot < 0 || targetSlot > 2) return false;

    // Swap
    const temp = myHand.cards[mySlot];
    myHand.cards[mySlot] = targetHand.cards[targetSlot];
    targetHand.cards[targetSlot] = temp;

    game.pendingAction = null;
    return true;
  }

  /**
   * Resolve Seven — Scramble: randomly rearrange an opponent's 3 cards.
   */
  resolveScramble(roomCode, playerId, targetPlayerId) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.PLAYING) return false;
    if (targetPlayerId === playerId) return false;

    const targetHand = game.hands[targetPlayerId];
    if (!targetHand) return false;

    // Fisher-Yates on the 3 cards
    const cards = targetHand.cards;
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    game.pendingAction = null;
    return true;
  }

  /**
   * After an action resolves (triggered from a swap), advance the turn.
   */
  finishActionAndAdvance(roomCode) {
    const game = this.games.get(roomCode);
    if (game) {
      game.pendingAction = null;
    }
    this._advanceTurn(roomCode);
  }

  /**
   * Get the sanitized game state for a specific player (hides other players' cards).
   */
  getPlayerView(roomCode, playerId) {
    const game = this.games.get(roomCode);
    if (!game) return null;

    const view = {
      phase: game.phase,
      drawPileCount: game.drawPile.length,
      discardPile: game.discardPile.length > 0
        ? [{ ...game.discardPile[game.discardPile.length - 1] }]
        : [],
      currentPlayerId: game.playerOrder[game.currentPlayerIndex],
      playerOrder: game.playerOrder,
      roundNumber: game.roundNumber,
      totalRounds: game.totalRounds || 1,
      scores: { ...game.scores },
      myHand: null,
      otherPlayers: {},
      drawnCard: null,
      isMyTurn: game.playerOrder[game.currentPlayerIndex] === playerId
    };

    // Own hand
    if (game.hands[playerId]) {
      view.myHand = game.hands[playerId].cards.map(c => ({ ...c }));
    }

    // Other players — show card count but not values (face-down)
    for (const pid of game.playerOrder) {
      if (pid !== playerId && game.hands[pid]) {
        view.otherPlayers[pid] = {
          cardCount: game.hands[pid].cards.length
        };
      }
    }

    // Drawn card (only for the player who drew it)
    if (game.drawnByPlayerId === playerId && game.drawnCard) {
      view.drawnCard = { ...game.drawnCard };
    }

    return view;
  }

  /**
   * Get round results (only when round is over).
   */
  getRoundResults(roomCode) {
    const game = this.games.get(roomCode);
    if (!game || game.phase !== PHASE.ROUND_OVER) return null;

    const results = [];
    for (const playerId of game.playerOrder) {
      const hand = game.hands[playerId];
      const roundTotal = hand.cards.reduce((sum, c) => sum + getCardValue(c), 0);
      results.push({
        playerId,
        cards: hand.cards.map(c => ({ ...c })),
        roundTotal,
        total: roundTotal, // alias for backwards compatibility
        cumulativeScore: game.scores[playerId]
      });
    }

    // Sort by roundTotal ascending (lowest wins round)
    results.sort((a, b) => a.roundTotal - b.roundTotal);
    results[0].isWinner = true;

    return {
      roundNumber: game.roundNumber,
      totalRounds: game.totalRounds || 1,
      isMatchOver: this.isMatchOver(roomCode),
      scores: { ...game.scores },
      playerResults: results
    };
  }

  /**
   * Advance to the next player's turn.
   */
  _advanceTurn(roomCode) {
    const game = this.games.get(roomCode);
    if (!game) return;

    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;

    // Check if draw pile is empty — if so, end the round
    if (game.drawPile.length === 0) {
      this._endRound(roomCode);
    }
  }

  /**
   * End the current round.
   */
  _endRound(roomCode) {
    const game = this.games.get(roomCode);
    if (!game) return;

    if (game.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }

    game.phase = PHASE.ROUND_OVER;
    game.pendingAction = null;

    // Calculate scores
    for (const playerId of game.playerOrder) {
      const hand = game.hands[playerId];
      const total = hand.cards.reduce((sum, c) => sum + getCardValue(c), 0);
      game.scores[playerId] += total;
    }

    // Discard any held drawn card
    if (game.drawnCard) {
      game.discardPile.push(game.drawnCard);
      game.drawnCard = null;
      game.drawnByPlayerId = null;
    }
  }

  /**
   * Remove a game.
   */
  removeGame(roomCode) {
    const game = this.games.get(roomCode);
    if (game?.turnTimer) {
      clearTimeout(game.turnTimer);
      game.turnTimer = null;
    }
    this.games.delete(roomCode);
  }
}

export { PHASE };
export default GameManager;
