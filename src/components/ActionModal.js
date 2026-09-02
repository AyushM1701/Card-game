// src/components/ActionModal.js — Action card interaction overlays

import { createCard } from './Card.js';
import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import { showToast } from './Toast.js';

let modalOverlay = null;

function getOverlay() {
  if (!modalOverlay) {
    modalOverlay = document.getElementById('modal-overlay');
  }
  return modalOverlay;
}

function showModal(content) {
  const overlay = getOverlay();
  overlay.innerHTML = '';
  overlay.appendChild(content);
  overlay.classList.add('active');
}

function hideModal() {
  const overlay = getOverlay();
  overlay.classList.remove('active');
  overlay.innerHTML = '';
}

/**
 * Show the Peek Own modal (King).
 * Displays all 3 cards for a few seconds.
 */
export function showPeekOwnModal(cards, isTriggered = false) {
  const modal = document.createElement('div');
  modal.className = 'action-modal';

  modal.innerHTML = `
    <div class="action-modal-title shimmer-text">👑 Peek Own</div>
    <div class="action-modal-subtitle">Memorize your cards!</div>
    <div class="peek-cards" id="peek-own-cards" style="display:flex;gap:16px;justify-content:center;margin:24px 0;"></div>
    <div class="peek-timer" id="peek-timer" style="font-size:2rem;color:var(--gold);">5</div>
    <div style="font-size:0.875rem;color:var(--text-muted);">Cards will be hidden when timer runs out</div>
  `;

  showModal(modal);

  const cardContainer = modal.querySelector('#peek-own-cards');
  cards.forEach((card, i) => {
    const cardEl = createCard(card, { faceUp: true, large: true, dealing: true, dealIndex: i });
    cardContainer.appendChild(cardEl);
  });

  // Update client's memory
  clientState.setAllKnownCards(cards);

  // Countdown
  let seconds = 5;
  const timerEl = modal.querySelector('#peek-timer');
  const interval = setInterval(() => {
    seconds--;
    if (timerEl) timerEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(interval);
      hideModal();
    }
  }, 1000);
}

/**
 * Show the Peek Opponent modal (Queen).
 * Step 1: Pick an opponent.
 * Step 2: Show all 3 revealed cards of that opponent with a timer.
 */
export function showPeekOpponentModal(isTriggered = false) {
  const others = clientState.otherPlayers;

  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--card-red);">👸 Queen: Peek Opponent</div>
    <div class="action-modal-subtitle">Choose an opponent to reveal ALL their cards</div>
    <div class="action-modal-options" id="peek-opponent-list"></div>
  `;

  showModal(modal);

  const listEl = modal.querySelector('#peek-opponent-list');
  others.forEach(player => {
    const btn = document.createElement('button');
    btn.className = 'action-modal-option';
    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '1.1rem';
    iconSpan.style.marginRight = '8px';
    iconSpan.textContent = player.isBot ? '🤖' : '👤';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = player.name;
    btn.appendChild(iconSpan);
    btn.appendChild(document.createTextNode(' '));
    btn.appendChild(nameStrong);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Peeking...';

      if (isTriggered) {
        socketClient.emit('resolve-triggered-action', {
          actionType: 'peek-opponent',
          targetPlayerId: player.id
        }, (res) => {
          if (res.success && res.cards) {
            showPeekedCards(res.cards, player.name);
          } else {
            showToast('Error peeking opponent', { type: 'error' });
            hideModal();
          }
        });
      } else {
        socketClient.emit('resolve-peek-opponent', {
          targetPlayerId: player.id
        }, (res) => {
          if (res.success && res.cards) {
            showPeekedCards(res.cards, player.name);
          } else {
            showToast('Error peeking opponent', { type: 'error' });
            hideModal();
          }
        });
      }
    });
    listEl.appendChild(btn);
  });
}

function showPeekedCards(cards, playerName) {
  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--card-red);">👸 Queen: Peeked!</div>
    <div class="action-modal-subtitle" id="peek-subtitle"></div>
    <div class="peek-cards" id="peeked-cards-container" style="display:flex;gap:14px;justify-content:center;margin:20px 0;"></div>
    <div class="peek-timer" id="peek-timer" style="font-size:2rem;color:var(--gold);">5</div>
    <button class="btn btn-primary btn-sm" id="peek-got-it-btn" style="margin-top:8px;">Got It! ✅</button>
  `;

  const subtitleEl = modal.querySelector('#peek-subtitle');
  subtitleEl.appendChild(document.createTextNode('All 3 cards of '));
  const nameStrong = document.createElement('strong');
  nameStrong.textContent = playerName;
  subtitleEl.appendChild(nameStrong);

  showModal(modal);

  const container = modal.querySelector('#peeked-cards-container');
  cards.forEach((card, i) => {
    const cardEl = createCard(card, { faceUp: true, large: true, dealing: true, dealIndex: i });
    container.appendChild(cardEl);
  });

  let seconds = 5;
  const timerEl = modal.querySelector('#peek-timer');
  const gotItBtn = modal.querySelector('#peek-got-it-btn');

  let closed = false;
  const closeModal = () => {
    if (closed) return;
    closed = true;
    clearInterval(interval);
    hideModal();
  };

  gotItBtn.addEventListener('click', closeModal);

  const interval = setInterval(() => {
    seconds--;
    timerEl.textContent = seconds;
    if (seconds <= 0) {
      closeModal();
    }
  }, 1000);
}

/**
 * Show the Blind Trade modal (Jack).
 * Step 1: Pick your card slot.
 * Step 2: Pick an opponent.
 * Step 3: Pick their card slot.
 */
export function showBlindTradeModal(isTriggered = false) {
  let mySlot = null;
  let targetPlayer = null;

  // Step 1: Pick own slot
  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--info);">🃏 Blind Trade</div>
    <div class="action-modal-subtitle">Pick YOUR card to trade away</div>
    <div class="slot-picker" id="trade-my-slot"></div>
  `;

  showModal(modal);

  const mySlotPicker = modal.querySelector('#trade-my-slot');
  const slotLabels = ['1 (Left)', '2 (Mid)', '3 (Right)'];
  for (let i = 0; i < 3; i++) {
    const btn = document.createElement('button');
    btn.className = 'slot-pick-btn';
    btn.textContent = slotLabels[i];
    btn.style.width = 'auto';
    btn.style.padding = '10px 14px';
    btn.style.fontSize = 'var(--fs-sm)';
    btn.addEventListener('click', () => {
      mySlot = i;
      showTradeOpponentPicker(mySlot, isTriggered);
    });
    mySlotPicker.appendChild(btn);
  }
}

function showTradeOpponentPicker(mySlot, isTriggered) {
  const others = clientState.otherPlayers;

  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--info);">🃏 Blind Trade</div>
    <div class="action-modal-subtitle">Choose an opponent to trade with</div>
    <div class="action-modal-options" id="trade-opponent-list"></div>
  `;

  showModal(modal);

  const listEl = modal.querySelector('#trade-opponent-list');
  others.forEach(player => {
    const btn = document.createElement('button');
    btn.className = 'action-modal-option';
    btn.textContent = player.name;
    btn.addEventListener('click', () => {
      showTradeSlotPicker(mySlot, player, isTriggered);
    });
    listEl.appendChild(btn);
  });
}

function showTradeSlotPicker(mySlot, targetPlayer, isTriggered) {
  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--info);">🃏 Blind Trade</div>
    <div class="action-modal-subtitle" id="trade-target-subtitle"></div>
    <div class="slot-picker" id="trade-target-slot"></div>
  `;

  const subtitleEl = modal.querySelector('#trade-target-subtitle');
  subtitleEl.appendChild(document.createTextNode('Pick '));
  const targetStrong = document.createElement('strong');
  targetStrong.textContent = targetPlayer.name;
  subtitleEl.appendChild(targetStrong);
  subtitleEl.appendChild(document.createTextNode("'s card to receive"));

  showModal(modal);

  const pickerEl = modal.querySelector('#trade-target-slot');
  const slotLabels = ['1 (Left)', '2 (Mid)', '3 (Right)'];
  for (let i = 0; i < 3; i++) {
    const btn = document.createElement('button');
    btn.className = 'slot-pick-btn';
    btn.textContent = slotLabels[i];
    btn.style.width = 'auto';
    btn.style.padding = '10px 14px';
    btn.style.fontSize = 'var(--fs-sm)';
    btn.addEventListener('click', () => {
      if (isTriggered) {
        socketClient.emit('resolve-triggered-action', {
          actionType: 'blind-trade',
          mySlot,
          targetPlayerId: targetPlayer.id,
          targetSlot: i
        }, (res) => {
          if (res.success) {
            clientState.recordBlindTrade(mySlot);
          }
          hideModal();
        });
      } else {
        socketClient.emit('resolve-blind-trade', {
          mySlot,
          targetPlayerId: targetPlayer.id,
          targetSlot: i
        }, (res) => {
          if (res.success) {
            clientState.recordBlindTrade(mySlot);
          }
          hideModal();
        });
      }
    });
    pickerEl.appendChild(btn);
  }
}

/**
 * Show the Scramble modal (Seven).
 * Pick an opponent — their cards get shuffled.
 */
export function showScrambleModal(isTriggered = false) {
  const others = clientState.otherPlayers;

  const modal = document.createElement('div');
  modal.className = 'action-modal';
  modal.innerHTML = `
    <div class="action-modal-title" style="color:var(--warning);">🔀 Scramble</div>
    <div class="action-modal-subtitle">Choose an opponent to scramble</div>
    <div class="action-modal-options" id="scramble-opponent-list"></div>
  `;

  showModal(modal);

  const listEl = modal.querySelector('#scramble-opponent-list');
  others.forEach(player => {
    const btn = document.createElement('button');
    btn.className = 'action-modal-option';
    btn.textContent = player.name;
    btn.addEventListener('click', () => {
      if (isTriggered) {
        socketClient.emit('resolve-triggered-action', {
          actionType: 'scramble',
          targetPlayerId: player.id
        }, (res) => {
          if (res.success) {
            showToast(`Scrambled ${player.name}'s cards!`, { type: 'warning', icon: '🔀' });
          }
          hideModal();
        });
      } else {
        socketClient.emit('resolve-scramble', {
          targetPlayerId: player.id
        }, (res) => {
          if (res.success) {
            showToast(`Scrambled ${player.name}'s cards!`, { type: 'warning', icon: '🔀' });
          }
          hideModal();
        });
      }
    });
    listEl.appendChild(btn);
  });
}

/**
 * Dispatch to the correct action modal based on type.
 */
export function showActionModal(actionType, isTriggered = false, extraData = null) {
  switch (actionType) {
    case 'peek-own':
      if (extraData?.cards) {
        showPeekOwnModal(extraData.cards, isTriggered);
      } else {
        // Request cards from server using appropriate event based on isTriggered
        if (isTriggered) {
          socketClient.emit('resolve-triggered-action', { actionType: 'peek-own' }, (res) => {
            if (res.success && res.cards) {
              showPeekOwnModal(res.cards, true);
            } else {
              showToast('Error resolving peek own', { type: 'error' });
            }
          });
        } else {
          socketClient.emit('resolve-peek-own', null, (res) => {
            if (res.success && res.cards) {
              showPeekOwnModal(res.cards, false);
            } else {
              showToast('Error resolving peek own', { type: 'error' });
            }
          });
        }
      }
      break;
    case 'peek-opponent':
      showPeekOpponentModal(isTriggered);
      break;
    case 'blind-trade':
      showBlindTradeModal(isTriggered);
      break;
    case 'scramble':
      showScrambleModal(isTriggered);
      break;
  }
}

export { hideModal };
export default { showActionModal, hideModal };
