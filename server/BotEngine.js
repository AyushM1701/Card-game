// server/BotEngine.js — AI Bot Strategy & Execution Engine

import { isActionCard, getActionType, getCardValue } from './Deck.js';

const BOT_NAMES = [
  'AceBot 🤖', 'NeonCard 🤖', 'ShadowKing 🤖', 'CyberQueen 🤖',
  'ByteJack 🤖', 'LuckySeven 🤖', 'VelvetAI 🤖', 'PokerBot 🤖'
];

class BotEngine {
  constructor() {
    /** @type {Map<string, { [botId: string]: Array<object|null> }>} roomCode -> botId -> knownCards[3] */
    this.botMemories = new Map();
  }

  getRandomName(existingNames = []) {
    const available = BOT_NAMES.filter(name => !existingNames.includes(name));
    if (available.length === 0) {
      return `Bot ${Math.floor(Math.random() * 900 + 100)} 🤖`;
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Initialize bot memory for a room at game start
   */
  initRoom(roomCode, gameState) {
    const roomMemory = {};
    for (const pid of gameState.playerOrder) {
      const hand = gameState.hands[pid];
      if (hand) {
        // Bots initially remember only their own dealt cards.
        // Opponent cards start completely unknown.
        if (hand.isBot || pid.startsWith('bot_')) {
          roomMemory[pid] = hand.cards.map(c => ({ ...c }));
        } else {
          roomMemory[pid] = [null, null, null];
        }
      }
    }
    this.botMemories.set(roomCode, roomMemory);
  }

  getMemory(roomCode, botId) {
    let roomMem = this.botMemories.get(roomCode);
    if (!roomMem) {
      roomMem = {};
      this.botMemories.set(roomCode, roomMem);
    }
    if (!roomMem[botId]) {
      roomMem[botId] = [null, null, null];
    }
    return roomMem[botId];
  }

  updateMemorySlot(roomCode, botId, slotIndex, card) {
    const mem = this.getMemory(roomCode, botId);
    mem[slotIndex] = card ? { ...card } : null;
  }

  scrambleMemory(roomCode, targetId) {
    const roomMem = this.botMemories.get(roomCode);
    if (roomMem && roomMem[targetId]) {
      roomMem[targetId] = [null, null, null];
    }
  }

  /**
   * Remove all bot memory for a room (call on room deletion to prevent memory leaks).
   */
  clearRoom(roomCode) {
    this.botMemories.delete(roomCode);
  }

  /**
   * Main turn processor for a bot
   */
  async processBotTurn(roomCode, botId, gameManager, roomManager, io, emitTurnChange) {
    const game = gameManager.getGame(roomCode);
    const room = roomManager.getRoom(roomCode);
    if (!game || !room || game.phase !== 'playing') return;
    if (gameManager.getCurrentPlayerId(roomCode) !== botId) return;

    // Realistic thinking delay
    await new Promise(res => setTimeout(res, 1200 + Math.random() * 1000));

    // Check again after delay
    const activeGame = gameManager.getGame(roomCode);
    const activeRoom = roomManager.getRoom(roomCode);
    if (!activeGame || !activeRoom || activeGame.phase !== 'playing') return;
    if (gameManager.getCurrentPlayerId(roomCode) !== botId) return;

    // 1. Draw Card
    const drawResult = gameManager.drawCard(roomCode, botId);
    if (!drawResult) {
      if (activeGame.phase === 'round_over' && !activeGame.roundOverEmitted) {
        activeGame.roundOverEmitted = true;
        const results = gameManager.getRoundResults(roomCode);
        io.to(roomCode).emit('round-over', { results });
      }
      return;
    }

    const drawnCard = drawResult.card;
    io.to(roomCode).emit('player-drew-card', {
      playerId: botId,
      drawPileCount: drawResult.pileCount
    });
    io.to(roomCode).emit('draw-pile-update', { count: drawResult.pileCount });

    // Thinking delay after drawing
    await new Promise(res => setTimeout(res, 1000 + Math.random() * 800));

    const postDrawGame = gameManager.getGame(roomCode);
    const postDrawRoom = roomManager.getRoom(roomCode);
    if (!postDrawGame || !postDrawRoom || postDrawGame.phase !== 'playing') return;
    if (gameManager.getCurrentPlayerId(roomCode) !== botId) return;

    // 2. Decide action
    const mem = this.getMemory(roomCode, botId);
    const isAction = isActionCard(drawnCard);

    if (isAction) {
      // Decide whether to play immediately or bank
      const actionType = getActionType(drawnCard);
      // Play immediately ~80% of time unless banking is advantageous
      const shouldPlay = Math.random() < 0.8;

      if (shouldPlay) {
        const playRes = gameManager.playActionImmediately(roomCode, botId);
        if (playRes.success) {
          io.to(roomCode).emit('player-played-action', {
            playerId: botId,
            actionType
          });

          await this._resolveBotAction(actionType, roomCode, botId, gameManager, roomManager, io, emitTurnChange);
          return;
        }
      }

      // If banking: find slot with highest estimated value card based on memory
      let bestSlot = 0;
      let maxVal = -1;
      for (let i = 0; i < 3; i++) {
        const val = mem[i] ? getCardValue(mem[i]) : 6;
        if (val > maxVal) {
          maxVal = val;
          bestSlot = i;
        }
      }

      const swapRes = gameManager.swapCard(roomCode, botId, bestSlot);
      if (swapRes.success) {
        this.updateMemorySlot(roomCode, botId, bestSlot, drawnCard);
        io.to(roomCode).emit('player-swapped', {
          playerId: botId,
          slotIndex: bestSlot,
          discardedCard: swapRes.displaced
        });

        if (swapRes.actionTriggered) {
          io.to(roomCode).emit('player-played-action', {
            playerId: botId,
            actionType: swapRes.actionTriggered
          });
          await this._resolveBotAction(swapRes.actionTriggered, roomCode, botId, gameManager, roomManager, io, emitTurnChange);
        } else {
          emitTurnChange(io, roomCode, gameManager, roomManager);
        }
      } else {
        gameManager.discardDrawn(roomCode, botId);
        io.to(roomCode).emit('player-discarded', { playerId: botId, card: drawnCard });
        emitTurnChange(io, roomCode, gameManager, roomManager);
      }
    } else {
      // Plain card: find slot where drawn card is lower than memory of slot card
      let candidateSlots = [];
      for (let i = 0; i < 3; i++) {
        const slotMem = mem[i];
        if (slotMem) {
          if (drawnCard.value < slotMem.value) {
            const diff = slotMem.value - drawnCard.value;
            candidateSlots.push({ slot: i, diff });
          }
        } else {
          // Unknown slot: if drawn card is low (<= 4), taking a shot is good strategy
          if (drawnCard.value <= 4) {
            const diff = 7 - drawnCard.value;
            candidateSlots.push({ slot: i, diff });
          }
        }
      }

      if (candidateSlots.length > 0) {
        // Pick the slot with biggest expected improvement
        candidateSlots.sort((a, b) => b.diff - a.diff);
        const targetSlot = candidateSlots[0].slot;

        const swapRes = gameManager.swapCard(roomCode, botId, targetSlot);
        if (swapRes.success) {
          this.updateMemorySlot(roomCode, botId, targetSlot, drawnCard);
          io.to(roomCode).emit('player-swapped', {
            playerId: botId,
            slotIndex: targetSlot,
            discardedCard: swapRes.displaced
          });

          if (swapRes.actionTriggered) {
            io.to(roomCode).emit('player-played-action', {
              playerId: botId,
              actionType: swapRes.actionTriggered
            });
            await this._resolveBotAction(swapRes.actionTriggered, roomCode, botId, gameManager, roomManager, io, emitTurnChange);
          } else {
            emitTurnChange(io, roomCode, gameManager, roomManager);
          }
        } else {
          gameManager.discardDrawn(roomCode, botId);
          io.to(roomCode).emit('player-discarded', { playerId: botId, card: drawnCard });
          emitTurnChange(io, roomCode, gameManager, roomManager);
        }
      } else {
        // Discard
        gameManager.discardDrawn(roomCode, botId);
        io.to(roomCode).emit('player-discarded', { playerId: botId, card: drawnCard });
        emitTurnChange(io, roomCode, gameManager, roomManager);
      }
    }
  }

  /**
   * Helper to select the most strategic opponent target
   */
  _getOpponentTarget(roomCode, botId, gameManager, strategy = 'lowest') {
    const game = gameManager.getGame(roomCode);
    if (!game) return null;
    const opponents = game.playerOrder.filter(id => id !== botId);
    if (opponents.length === 0) return null;

    const roomMem = this.botMemories.get(roomCode) || {};

    const scored = opponents.map(oppId => {
      const oppMem = roomMem[oppId] || [null, null, null];
      const known = oppMem.filter(c => c !== null);
      const knownSum = known.reduce((sum, c) => sum + getCardValue(c), 0);
      const unknownCount = 3 - known.length;
      const estimatedTotal = knownSum + unknownCount * 6;
      return { id: oppId, estimatedTotal, unknownCount, oppMem };
    });

    if (strategy === 'lowest') {
      scored.sort((a, b) => a.estimatedTotal - b.estimatedTotal);
      return scored[0].id;
    } else if (strategy === 'most_unknown') {
      scored.sort((a, b) => b.unknownCount - a.unknownCount);
      return scored[0].id;
    }

    return opponents[Math.floor(Math.random() * opponents.length)];
  }

  async _resolveBotAction(actionType, roomCode, botId, gameManager, roomManager, io, emitTurnChange) {
    let game = gameManager.getGame(roomCode);
    let room = roomManager.getRoom(roomCode);
    if (!game || !room || game.phase !== 'playing') return;

    await new Promise(res => setTimeout(res, 600));

    game = gameManager.getGame(roomCode);
    room = roomManager.getRoom(roomCode);
    if (!game || !room || game.phase !== 'playing') return;

    switch (actionType) {
      case 'peek-own': {
        const cards = gameManager.resolvePeekOwn(roomCode, botId);
        if (cards) {
          const roomMem = this.botMemories.get(roomCode) || {};
          roomMem[botId] = cards.map(c => ({ ...c }));
          this.botMemories.set(roomCode, roomMem);
        }
        break;
      }
      case 'peek-opponent': {
        const targetOpponent = this._getOpponentTarget(roomCode, botId, gameManager, 'most_unknown');
        if (targetOpponent) {
          const cards = gameManager.resolvePeekOpponent(roomCode, botId, targetOpponent);
          if (cards) {
            const roomMem = this.botMemories.get(roomCode) || {};
            roomMem[targetOpponent] = cards.map(c => ({ ...c }));
            this.botMemories.set(roomCode, roomMem);
          }
          const targetPlayer = room.players.find(p => p.id === targetOpponent);
          if (targetPlayer && targetPlayer.socketId) {
            io.to(targetPlayer.socketId).emit('you-were-peeked', {
              byPlayerId: botId
            });
          }
          io.to(roomCode).emit('player-peeked-opponent', {
            sourcePlayerId: botId,
            targetPlayerId: targetOpponent
          });
        }
        break;
      }
      case 'blind-trade': {
        const targetOpponent = this._getOpponentTarget(roomCode, botId, gameManager, 'lowest');
        if (targetOpponent) {
          // Identify bot's highest known card slot to give away
          const myMem = this.getMemory(roomCode, botId);
          let mySlot = 0;
          let myMax = -1;
          for (let i = 0; i < 3; i++) {
            const val = myMem[i] ? getCardValue(myMem[i]) : 5;
            if (val > myMax) {
              myMax = val;
              mySlot = i;
            }
          }

          // Identify opponent's best slot to steal (lowest known or unknown)
          const oppMem = (this.botMemories.get(roomCode) || {})[targetOpponent] || [null, null, null];
          let targetSlot = 0;
          let oppMin = 999;
          let hasKnown = false;
          for (let i = 0; i < 3; i++) {
            if (oppMem[i]) {
              const v = getCardValue(oppMem[i]);
              if (v < oppMin) {
                oppMin = v;
                targetSlot = i;
                hasKnown = true;
              }
            }
          }
          if (!hasKnown) {
            const unknownSlots = [0, 1, 2].filter(i => !oppMem[i]);
            targetSlot = unknownSlots.length > 0 ? unknownSlots[0] : Math.floor(Math.random() * 3);
          }

          const success = gameManager.resolveBlindTrade(roomCode, botId, mySlot, targetOpponent, targetSlot);
          if (success) {
            this.updateMemorySlot(roomCode, botId, mySlot, null);
            this.updateMemorySlot(roomCode, targetOpponent, targetSlot, null);
            io.to(roomCode).emit('blind-trade-complete', {
              playerId: botId,
              mySlot,
              targetPlayerId: targetOpponent,
              targetSlot
            });
          }
        }
        break;
      }
      case 'scramble': {
        const targetOpponent = this._getOpponentTarget(roomCode, botId, gameManager, 'lowest');
        if (targetOpponent) {
          const success = gameManager.resolveScramble(roomCode, botId, targetOpponent);
          if (success) {
            this.scrambleMemory(roomCode, targetOpponent);
            io.to(roomCode).emit('cards-scrambled', {
              playerId: botId,
              targetPlayerId: targetOpponent
            });
          }
        }
        break;
      }
    }

    gameManager.finishActionAndAdvance(roomCode);
    emitTurnChange(io, roomCode, gameManager, roomManager);
  }
}

const botEngine = new BotEngine();
export { BotEngine };
export default botEngine;
