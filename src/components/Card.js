// src/components/Card.js — Individual card component with 3D flip

import { getSuitSymbol, isRedSuit, isActionCard, getActionName } from '../game/CardUtils.js';

/**
 * Create a card element.
 * @param {object} card - { rank, suit, value } or null for face-down
 * @param {object} options - { faceUp, interactive, large, dealing, dealIndex, onClick }
 * @returns {HTMLElement}
 */
export function createCard(card, options = {}) {
  const {
    faceUp = false,
    interactive = false,
    large = false,
    dealing = false,
    dealIndex = 0,
    onClick = null,
    showActionBadge = false
  } = options;

  const container = document.createElement('div');
  container.className = 'card';
  if (faceUp) container.classList.add('flipped');
  if (interactive) container.classList.add('card-interactive');
  if (large) container.classList.add('card-lg');
  if (dealing) {
    container.classList.add('card-dealing');
    container.style.animationDelay = `${dealIndex * 150}ms`;
  }

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Back
  const back = document.createElement('div');
  back.className = 'card-back';
  const pattern = document.createElement('div');
  pattern.className = 'card-back-pattern';
  const emblem = document.createElement('div');
  emblem.className = 'card-back-emblem';
  back.appendChild(pattern);
  back.appendChild(emblem);

  // Front
  const front = document.createElement('div');
  front.className = 'card-front';
  if (card && isRedSuit(card.suit)) {
    front.classList.add('red');
  }

  if (card) {
    const suitSym = getSuitSymbol(card.suit);

    // Top rank
    const rankTop = document.createElement('div');
    rankTop.className = 'card-rank-top';
    rankTop.textContent = card.rank;
    const suitMiniTop = document.createElement('span');
    suitMiniTop.className = 'suit-mini';
    suitMiniTop.textContent = suitSym;
    rankTop.appendChild(suitMiniTop);

    // Center suit
    const centerSuit = document.createElement('div');
    centerSuit.className = 'card-center-suit';
    centerSuit.textContent = suitSym;

    // Bottom rank
    const rankBottom = document.createElement('div');
    rankBottom.className = 'card-rank-bottom';
    rankBottom.textContent = card.rank;
    const suitMiniBottom = document.createElement('span');
    suitMiniBottom.className = 'suit-mini';
    suitMiniBottom.textContent = suitSym;
    rankBottom.appendChild(suitMiniBottom);

    front.appendChild(rankTop);
    front.appendChild(centerSuit);
    front.appendChild(rankBottom);
  }

  inner.appendChild(back);
  inner.appendChild(front);
  container.appendChild(inner);

  // Action badge
  if (showActionBadge && card && isActionCard(card)) {
    const badge = document.createElement('div');
    badge.className = 'card-action-badge';
    badge.textContent = getActionName(card);
    container.appendChild(badge);
  }

  // Click handler
  if (onClick) {
    container.addEventListener('click', () => onClick(card));
  }

  return container;
}

/**
 * Create a card-back-only element (for other players' hands).
 */
export function createCardBack(options = {}) {
  return createCard(null, { ...options, faceUp: false });
}

/**
 * Flip a card element.
 */
export function flipCard(cardElement, show) {
  if (show) {
    cardElement.classList.add('flipped');
  } else {
    cardElement.classList.remove('flipped');
  }
}

export default { createCard, createCardBack, flipCard };
