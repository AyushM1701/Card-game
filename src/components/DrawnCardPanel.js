// src/components/DrawnCardPanel.js — Floating panel for drawn card decisions

import { createCard } from './Card.js';
import { isActionCard, getActionName, canSwapPlain } from '../game/CardUtils.js';
import clientState from '../game/ClientState.js';

/**
 * Create the drawn card decision panel.
 * @param {object} card - The drawn card
 * @param {Function} onSwap - (slotIndex) => void
 * @param {Function} onDiscard - () => void
 * @param {Function} onPlayAction - () => void (only for action cards)
 * @param {Function} onBankAction - (slotIndex) => void (only for action cards)
 */
export function createDrawnCardPanel(card, { onSwap, onDiscard, onPlayAction, onBankAction }) {
  const panel = document.createElement('div');
  panel.className = 'drawn-card-panel';
  panel.id = 'drawn-card-panel';

  // The drawn card (face up, large)
  const cardEl = createCard(card, { faceUp: true, large: true, showActionBadge: true });
  panel.appendChild(cardEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'drawn-card-actions';

  const isAction = isActionCard(card);

  if (isAction) {
    // Action card: can Play Now, Bank into slot, or Discard
    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-primary btn-sm';
    playBtn.style.fontWeight = '700';
    playBtn.textContent = `▶ Play: ${getActionName(card)}`;
    playBtn.addEventListener('click', onPlayAction);
    actions.appendChild(playBtn);

    // Bank into slot options
    const bankLabel = document.createElement('div');
    bankLabel.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:6px;';
    bankLabel.textContent = 'Or bank into slot:';
    actions.appendChild(bankLabel);

    const slotBtns = document.createElement('div');
    slotBtns.style.cssText = 'display:flex;gap:6px;';
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = `Slot #${i + 1}`;
      btn.addEventListener('click', () => onBankAction(i));
      slotBtns.appendChild(btn);
    }
    actions.appendChild(slotBtns);
  } else {
    // Plain card: show swap options with valid indicators
    const swapLabel = document.createElement('div');
    swapLabel.style.cssText = 'font-size:0.75rem;color:var(--text-secondary);font-weight:600;';
    swapLabel.textContent = 'Swap with a HIGHER slot:';
    actions.appendChild(swapLabel);

    const slotBtns = document.createElement('div');
    slotBtns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      const knownCard = clientState.knownCards[i];
      const valid = knownCard ? canSwapPlain(card, knownCard) : true; // If unknown, allow attempt

      if (knownCard) {
        if (valid) {
          btn.className = 'btn btn-primary btn-sm';
          btn.textContent = `#${i + 1} (${knownCard.rank}) ⬇️`;
          btn.title = `Swap: replace ${knownCard.rank} with lower ${card.rank}`;
        } else {
          btn.className = 'btn btn-secondary btn-sm';
          btn.style.opacity = '0.55';
          btn.textContent = `#${i + 1} (${knownCard.rank}) 🚫`;
          btn.title = `Cannot swap: drawn ${card.rank} is higher than slot ${knownCard.rank}`;
        }
      } else {
        btn.className = 'btn btn-secondary btn-sm';
        btn.textContent = `Slot #${i + 1} (?)`;
        btn.title = `Attempt swap with slot #${i + 1}`;
      }

      btn.addEventListener('click', () => onSwap(i));
      slotBtns.appendChild(btn);
    }
    actions.appendChild(slotBtns);

    const hintText = document.createElement('div');
    hintText.style.cssText = 'font-size:0.7rem;color:var(--text-muted);max-width:240px;line-height:1.2;margin-top:2px;';
    hintText.textContent = '💡 Rule: Plain cards can only replace higher cards. Discard if you drew higher.';
    actions.appendChild(hintText);
  }

  // Discard option
  const discardBtn = document.createElement('button');
  discardBtn.className = 'btn btn-secondary btn-sm';
  discardBtn.id = 'discard-drawn-btn';
  discardBtn.style.cssText = 'margin-top:8px;background:hsla(0, 72%, 50%, 0.15);border:1px solid hsla(0, 72%, 50%, 0.4);color:hsl(0, 85%, 70%);font-weight:600;';
  discardBtn.textContent = '🗑️ Discard & Keep Hand';
  discardBtn.addEventListener('click', onDiscard);
  actions.appendChild(discardBtn);

  panel.appendChild(actions);

  return panel;
}

/**
 * Remove the drawn card panel from the DOM.
 */
export function removeDrawnCardPanel() {
  const panel = document.getElementById('drawn-card-panel');
  if (panel) {
    panel.style.animation = 'fadeOut 0.3s var(--ease-out) forwards';
    setTimeout(() => panel.remove(), 300);
  }
}

export default { createDrawnCardPanel, removeDrawnCardPanel };
