// src/screens/GameScreen.js — Main game table screen

import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import soundEngine from '../game/SoundEngine.js';
import cardAnimationEngine from '../game/CardAnimationEngine.js';
import { createTable, updateTableCenter, updateSeatHighlights } from '../components/Table.js';
import { createDrawnCardPanel, removeDrawnCardPanel } from '../components/DrawnCardPanel.js';
import { showActionModal, hideModal } from '../components/ActionModal.js';
import { showToast } from '../components/Toast.js';
import { createCard } from '../components/Card.js';
import { isActionCard, getActionType } from '../game/CardUtils.js';

let currentNavigate = null;
let registeredListeners = []; // Track all registered socket listeners for cleanup

function cleanupListeners() {
  registeredListeners.forEach(({ event, handler }) => {
    socketClient.off(event, handler);
  });
  registeredListeners = [];
}

function onSocket(event, handler) {
  socketClient.on(event, handler);
  registeredListeners.push({ event, handler });
}

/**
 * Render the game screen.
 * @param {Function} navigate
 */
export function renderGameScreen(navigate) {
  cleanupListeners(); // Remove old listeners before re-registering
  currentNavigate = navigate;
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Clear any stale animation elements (UX-7)
  const animLayer = document.getElementById('card-animation-layer');
  if (animLayer) animLayer.innerHTML = '';

  // HUD
  const hud = createHUD();
  app.appendChild(hud);

  // If we're in peek phase (and not a spectator), show the peek overlay
  if (clientState.phase === 'peek_phase' && !clientState.isSpectator) {
    renderPeekPhase(app);
  }

  // Table
  const table = createTable(handleDraw, handleSwap);
  app.appendChild(table);

  // If user already holds a drawn card on their turn, restore the panel
  if (clientState.drawnCard && clientState.isMyTurn && !clientState.isSpectator) {
    ensureDrawnCardPanel(clientState.drawnCard);
  }

  // Set up socket listeners
  setupGameListeners(navigate);
}

function createHUD() {
  const hud = document.createElement('div');
  hud.className = 'game-hud';

  const left = document.createElement('div');
  left.className = 'hud-left';
  const roomCode = document.createElement('span');
  roomCode.className = 'hud-room-code';
  roomCode.textContent = `ROOM: ${clientState.roomCode}`;
  left.appendChild(roomCode);

  // Leave Game button
  if (!clientState.isSpectator) {
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'btn btn-ghost btn-sm hud-leave-btn';
    leaveBtn.id = 'leave-game-btn';
    leaveBtn.title = 'Leave game';
    leaveBtn.innerHTML = '🚪 <span class="hud-leave-label">Leave</span>';
    leaveBtn.addEventListener('click', () => showLeaveConfirmModal(navigate));
    left.appendChild(leaveBtn);
  }

  if (clientState.isSpectator) {
    const specBadge = document.createElement('span');
    specBadge.className = 'you-badge';
    specBadge.style.background = 'hsla(210, 80%, 58%, 0.15)';
    specBadge.style.color = 'var(--info)';
    specBadge.textContent = '👁 SPECTATING';
    left.appendChild(specBadge);
  }

  const center = document.createElement('div');
  center.className = 'hud-center';
  const turnInd = document.createElement('span');
  turnInd.className = `hud-turn-indicator ${clientState.isMyTurn && !clientState.isSpectator ? 'my-turn' : ''}`;
  turnInd.id = 'hud-turn';
  turnInd.textContent = clientState.isMyTurn && !clientState.isSpectator
    ? "🎯 Your Turn!"
    : `${clientState.getPlayerName(clientState.currentPlayerId)}'s turn`;
  center.appendChild(turnInd);

  const right = document.createElement('div');
  right.className = 'hud-right';

  const round = document.createElement('span');
  round.className = 'hud-round';
  round.textContent = clientState.totalRounds > 1
    ? `Round ${clientState.roundNumber} / ${clientState.totalRounds}`
    : `Round ${clientState.roundNumber}`;
  right.appendChild(round);

  // Sound Mute Toggle
  const muteBtn = document.createElement('button');
  muteBtn.className = 'btn btn-ghost btn-sm';
  muteBtn.id = 'mute-toggle-btn';
  muteBtn.style.padding = '4px 8px';
  muteBtn.style.fontSize = '14px';
  muteBtn.textContent = soundEngine.isMuted() ? '🔇' : '🔊';
  muteBtn.title = soundEngine.isMuted() ? 'Unmute audio' : 'Mute audio';
  muteBtn.addEventListener('click', () => {
    const isNowMuted = soundEngine.toggleMute();
    muteBtn.textContent = isNowMuted ? '🔇' : '🔊';
    muteBtn.title = isNowMuted ? 'Unmute audio' : 'Mute audio';
    showToast(isNowMuted ? 'Audio muted' : 'Audio unmuted', { type: 'info', icon: isNowMuted ? '🔇' : '🔊' });
  });
  right.appendChild(muteBtn);

  hud.appendChild(left);
  hud.appendChild(center);
  hud.appendChild(right);

  return hud;
}

function renderPeekPhase(app) {
  soundEngine.cardDeal(100);

  const overlay = document.createElement('div');
  overlay.className = 'peek-overlay';
  overlay.id = 'peek-overlay';

  const instruction = document.createElement('div');
  instruction.className = 'peek-instruction';
  instruction.textContent = 'Memorize your cards!';
  instruction.style.marginBottom = 'var(--space-lg)';

  const cards = document.createElement('div');
  cards.className = 'peek-cards';

  clientState.myCards.forEach((card, i) => {
    const cardEl = createCard(card, { faceUp: true, large: true, dealing: true, dealIndex: i });
    cards.appendChild(cardEl);
  });

  const timer = document.createElement('div');
  timer.className = 'peek-timer';
  timer.id = 'peek-phase-timer';

  let seconds = 8;
  timer.textContent = seconds;

  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn btn-primary btn-lg';
  doneBtn.style.marginTop = 'var(--space-xl)';
  doneBtn.textContent = 'I\'ve Memorized! ✅';
  doneBtn.id = 'peek-done-btn';

  let peekDone = false;
  const finishPeek = () => {
    if (peekDone) return;
    peekDone = true;
    soundEngine.cardFlip();
    socketClient.emit('peek-done');
    doneBtn.disabled = true;
    doneBtn.textContent = 'Waiting for others...';
    clearInterval(countdown);
  };

  doneBtn.addEventListener('click', finishPeek);

  const countdown = setInterval(() => {
    seconds--;
    const timerEl = document.getElementById('peek-phase-timer');
    if (timerEl) timerEl.textContent = seconds;
    if (seconds <= 0) {
      finishPeek();
    }
  }, 1000);

  overlay.appendChild(instruction);
  overlay.appendChild(cards);
  overlay.appendChild(timer);
  overlay.appendChild(doneBtn);
  app.appendChild(overlay);
}

function ensureDrawnCardPanel(card = null) {
  const currentCard = card || clientState.drawnCard;
  if (!currentCard || !clientState.isMyTurn || clientState.isSpectator) return;

  const existingPanel = document.getElementById('drawn-card-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  const panel = createDrawnCardPanel(currentCard, {
    onSwap: (slotIndex) => handleSwap(slotIndex),
    onDiscard: handleDiscard,
    onPlayAction: () => handlePlayAction(),
    onBankAction: (slotIndex) => handleSwap(slotIndex)
  });
  document.body.appendChild(panel);
}

function highlightDrawnCardPanel() {
  const panel = document.getElementById('drawn-card-panel');
  if (panel) {
    panel.classList.remove('panel-highlight');
    void panel.offsetWidth;
    panel.classList.add('panel-highlight');
  }
}

function handleDraw() {
  if (clientState.isSpectator) {
    showToast("You are spectating this match.", { type: 'info', icon: '👁️' });
    return;
  }
  if (!clientState.isMyTurn) {
    showToast("It's not your turn!", { type: 'warning' });
    return;
  }
  if (clientState.drawnCard) {
    ensureDrawnCardPanel(clientState.drawnCard);
    highlightDrawnCardPanel();
    const rankStr = clientState.drawnCard.rank || 'a card';
    showToast(`Already holding ${rankStr}. Pick a slot to swap, or click Discard.`, { type: 'info', icon: '🃏' });
    return;
  }

  socketClient.emit('draw-card', null, (res) => {
    if (res.roundOver) {
      return;
    }
    if (!res.success) {
      showToast(res.error || "Can't draw right now", { type: 'error' });
      return;
    }

    clientState.setDrawnCard(res.card);

    // Animate card fly from draw pile to user seat
    cardAnimationEngine.animateDraw({
      playerId: clientState.playerId,
      card: res.card,
      isUser: true,
      onComplete: () => {
        ensureDrawnCardPanel(res.card);
      }
    });
  });
}

function handleSwap(slotIndex) {
  soundEngine.click();
  socketClient.emit('swap-card', { slotIndex }, (res) => {
    if (!res.success) {
      showToast(res.error || 'Swap failed. Please try again.', { type: 'warning', icon: '⚠️' });
      ensureDrawnCardPanel(clientState.drawnCard);
      highlightDrawnCardPanel();
      return;
    }

    removeDrawnCardPanel();

    const drawnCard = clientState.drawnCard;
    clientState.recordSwap(slotIndex, drawnCard);

    // Animate displaced card flying to discard pile
    if (res.displaced) {
      cardAnimationEngine.animateSwap({
        playerId: clientState.playerId,
        slotIndex,
        card: drawnCard,
        displacedCard: res.displaced,
        onComplete: () => {
          clientState.addToDiscard(res.displaced);
          updateTableCenter(handleDraw);
        }
      });
    }

    // If an action was triggered (displaced action card)
    if (res.actionTriggered) {
      cardAnimationEngine.triggerActionFX({
        actionType: res.actionTriggered,
        sourcePlayerId: clientState.playerId
      });
      showActionModal(res.actionTriggered, true);
    }
  });
}

function handleDiscard() {
  soundEngine.click();
  socketClient.emit('discard-drawn', null, (res) => {
    if (!res.success) {
      showToast(res.error || 'Discard failed', { type: 'error' });
      ensureDrawnCardPanel(clientState.drawnCard);
      return;
    }

    removeDrawnCardPanel();

    const discardedCard = clientState.drawnCard;
    if (discardedCard) {
      cardAnimationEngine.animateDiscard({
        playerId: clientState.playerId,
        card: discardedCard
      });
      clientState.addToDiscard(discardedCard);
    }
    clientState.clearDrawnCard();
    refreshTable();
  });
}

function handlePlayAction() {
  soundEngine.click();
  socketClient.emit('play-action-immediately', null, (res) => {
    if (!res.success) {
      showToast(res.error || 'Failed to play action', { type: 'error' });
      ensureDrawnCardPanel(clientState.drawnCard);
      return;
    }

    removeDrawnCardPanel();

    cardAnimationEngine.triggerActionFX({
      actionType: res.actionType,
      sourcePlayerId: clientState.playerId
    });

    clientState.clearDrawnCard();
    showActionModal(res.actionType, false);
  });
}

function refreshTable() {
  const app = document.getElementById('app');
  const oldTable = app.querySelector('.game-table-wrapper');
  const newTable = createTable(handleDraw, handleSwap);

  if (oldTable) {
    app.replaceChild(newTable, oldTable);
  } else {
    app.appendChild(newTable);
  }

  updateHUD();

  if (clientState.drawnCard && clientState.isMyTurn && !clientState.isSpectator) {
    ensureDrawnCardPanel(clientState.drawnCard);
  }
}

function updateHUD() {
  const turnEl = document.getElementById('hud-turn');
  if (turnEl) {
    turnEl.className = `hud-turn-indicator ${clientState.isMyTurn && !clientState.isSpectator ? 'my-turn' : ''}`;
    turnEl.textContent = clientState.isMyTurn && !clientState.isSpectator
      ? "🎯 Your Turn!"
      : `${clientState.getPlayerName(clientState.currentPlayerId)}'s turn`;
  }
}

function setupGameListeners(navigate) {
  // Peek phase complete
  onSocket('peek-phase-complete', (data) => {
    clientState.setPeekComplete(data.currentPlayerId);
    const overlay = document.getElementById('peek-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.5s var(--ease-out) forwards';
      setTimeout(() => overlay.remove(), 500);
    }
    refreshTable();
    if (clientState.isMyTurn && !clientState.isSpectator) {
      soundEngine.turnNotify();
      showToast("It's your turn! Draw a card.", { type: 'info', icon: '🎯' });
    }
  });

  // Turn change
  onSocket('turn-change', (data) => {
    clientState.updateTurn(data.currentPlayerId, data.drawPileCount);
    removeDrawnCardPanel();
    refreshTable();
    if (clientState.isMyTurn && !clientState.isSpectator) {
      soundEngine.turnNotify();
      showToast("It's your turn!", { type: 'info', icon: '🎯' });
    }
  });

  // Draw pile update
  onSocket('draw-pile-update', (data) => {
    clientState.updateDrawPile(data.count);
  });

  // Another player drew
  onSocket('player-drew-card', (data) => {
    clientState.updateDrawPile(data.drawPileCount);

    if (data.playerId !== clientState.playerId) {
      cardAnimationEngine.animateDraw({
        playerId: data.playerId,
        card: null,
        isUser: false,
        onComplete: () => updateTableCenter(handleDraw)
      });
    } else {
      updateTableCenter(handleDraw);
    }
  });

  // Another player swapped
  onSocket('player-swapped', (data) => {
    const name = clientState.getPlayerName(data.playerId);
    const slotNames = ['Left (#1)', 'Middle (#2)', 'Right (#3)'];
    const slotLabel = data.slotIndex !== undefined ? (slotNames[data.slotIndex] || `Slot #${data.slotIndex + 1}`) : 'a';
    showToast(`${name} swapped ${slotLabel} card`, { type: 'info', icon: '🔄' });

    if (data.playerId !== clientState.playerId && data.discardedCard) {
      cardAnimationEngine.animateSwap({
        playerId: data.playerId,
        slotIndex: data.slotIndex,
        card: null,
        displacedCard: data.discardedCard,
        onComplete: () => {
          clientState.addToDiscard(data.discardedCard);
          updateTableCenter(handleDraw);
        }
      });
    } else if (data.discardedCard) {
      clientState.addToDiscard(data.discardedCard);
      updateTableCenter(handleDraw);
    }
  });

  // Another player discarded
  onSocket('player-discarded', (data) => {
    if (data.playerId !== clientState.playerId) {
      const name = clientState.getPlayerName(data.playerId);
      showToast(`${name} discarded`, { type: 'info' });

      if (data.card) {
        cardAnimationEngine.animateDiscard({
          playerId: data.playerId,
          card: data.card,
          onComplete: () => {
            clientState.addToDiscard(data.card);
            updateTableCenter(handleDraw);
          }
        });
      }
    } else {
      if (data.card) {
        clientState.addToDiscard(data.card);
      }
      updateTableCenter(handleDraw);
    }
  });

  // Another player played an action
  onSocket('player-played-action', (data) => {
    cardAnimationEngine.triggerActionFX({
      actionType: data.actionType,
      sourcePlayerId: data.playerId
    });
  });

  // You were peeked at (Queen) — BUG-6: removed stale slotIndex
  onSocket('you-were-peeked', (data) => {
    cardAnimationEngine.triggerActionFX({
      actionType: 'peek-opponent',
      sourcePlayerId: data.byPlayerId,
      targetPlayerId: clientState.playerId
    });
  });

  // Blind trade complete
  onSocket('blind-trade-complete', (data) => {
    cardAnimationEngine.triggerActionFX({
      actionType: 'blind-trade',
      sourcePlayerId: data.playerId,
      targetPlayerId: data.targetPlayerId,
      extra: { mySlot: data.mySlot, targetSlot: data.targetSlot }
    });

    const sSlot = ['Left (#1)', 'Middle (#2)', 'Right (#3)'][data.mySlot] || `Slot #${(data.mySlot ?? 0) + 1}`;
    const tSlot = ['Left (#1)', 'Middle (#2)', 'Right (#3)'][data.targetSlot] || `Slot #${(data.targetSlot ?? 0) + 1}`;
    const sName = clientState.getPlayerName(data.playerId);
    const tName = clientState.getPlayerName(data.targetPlayerId);

    if (data.targetPlayerId === clientState.playerId) {
      clientState.recordBlindTrade(data.targetSlot);
      showToast(`${sName} traded ${sSlot} with YOUR ${tSlot}!`, { type: 'warning', icon: '🔄' });
    } else if (data.playerId === clientState.playerId) {
      showToast(`You traded your ${sSlot} with ${tName}'s ${tSlot}!`, { type: 'info', icon: '🔄' });
    } else {
      showToast(`${sName} traded ${sSlot} with ${tName}'s ${tSlot}`, { type: 'info', icon: '🔄' });
    }
    refreshTable();
  });

  // Cards scrambled
  onSocket('cards-scrambled', (data) => {
    cardAnimationEngine.triggerActionFX({
      actionType: 'scramble',
      sourcePlayerId: data.playerId,
      targetPlayerId: data.targetPlayerId
    });

    if (data.targetPlayerId === clientState.playerId) {
      clientState.recordScramble();
      const name = clientState.getPlayerName(data.playerId);
      showToast(`${name} scrambled your cards!`, { type: 'error', icon: '🔀' });
    }
  });

  // Spectator Sync
  onSocket('spectator-game-sync', (data) => {
    clientState.phase = data.phase;
    clientState.roundNumber = data.roundNumber || 1;
    clientState.totalRounds = data.totalRounds || 1;
    clientState.players = data.players || clientState.players;
    clientState.drawPileCount = data.drawPileCount || 0;
    clientState.discardPile = data.discardPile || [];
    clientState.currentPlayerId = data.currentPlayerId;
    refreshTable();
  });

  // Spectator count update
  onSocket('spectator-count-update', (data) => {
    clientState.spectatorCount = data.count;
  });

  // Round over
  onSocket('round-over', (data) => {
    clientState.setRoundResults(data.results);
    removeDrawnCardPanel();
    hideModal();
    navigate('results');
  });

  // Player disconnect
  onSocket('player-disconnected', (data) => {
    clientState.updatePlayers(data.players);
    showToast(`${data.playerName} disconnected`, { type: 'warning' });
  });

  // Turn timer warning for disconnected player
  onSocket('turn-timer-warning', (data) => {
    showToast(`Waiting for ${data.playerName} to reconnect (${data.seconds}s)...`, { type: 'info', icon: '⏳' });
  });

  // Player turn skipped
  onSocket('player-skipped', (data) => {
    showToast(`${data.playerName}'s turn was skipped (${data.reason || 'disconnected'})`, { type: 'warning', icon: '⏱️' });
  });
}

/**
 * Show a confirmation dialog before leaving the game.
 * Uses the existing #modal-overlay system.
 */
function showLeaveConfirmModal(navigate) {
  soundEngine.click();

  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = '';

  const modal = document.createElement('div');
  modal.className = 'action-modal leave-confirm-modal';

  const icon = document.createElement('div');
  icon.className = 'leave-confirm-icon';
  icon.textContent = '🚪';

  const title = document.createElement('div');
  title.className = 'leave-confirm-title';
  title.textContent = 'Leave the game?';

  const body = document.createElement('p');
  body.className = 'leave-confirm-body';
  body.textContent = 'Your seat will be lost. The round will continue with a bot filling in for you.';

  const warning = document.createElement('div');
  warning.className = 'leave-confirm-warning';
  warning.innerHTML = '⚠️ This cannot be undone. You will return to the lobby.';

  const btnRow = document.createElement('div');
  btnRow.className = 'leave-confirm-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary btn-lg';
  cancelBtn.id = 'leave-cancel-btn';
  cancelBtn.textContent = '↩ Stay';
  cancelBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    overlay.innerHTML = '';
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn leave-confirm-danger btn-lg';
  confirmBtn.id = 'leave-confirm-btn';
  confirmBtn.textContent = 'Leave Game';
  confirmBtn.addEventListener('click', () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Leaving...';

    // Clean up and navigate to lobby
    cleanupListeners();
    removeDrawnCardPanel();
    clientState.clearSession();
    socketClient.disconnect();

    overlay.classList.remove('active');
    overlay.innerHTML = '';

    // Small delay so the socket disconnect registers
    setTimeout(() => {
      socketClient.connect(); // reconnect for next game
      navigate('lobby');
    }, 250);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  modal.appendChild(icon);
  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(warning);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.classList.add('active');
}

export default { renderGameScreen };

