// src/components/DiscardPile.js — Discard pile component

import { createCard } from './Card.js';

/**
 * Create the discard pile element.
 * @param {Array} discardPile - array of cards, last one on top
 */
export function createDiscardPile(discardPile) {
  const container = document.createElement('div');
  container.className = 'pile-container';

  const stack = document.createElement('div');
  stack.className = 'card-stack';

  if (discardPile.length > 0) {
    // Show the top card face-up
    const topCard = discardPile[discardPile.length - 1];
    const cardEl = createCard(topCard, { faceUp: true });
    stack.appendChild(cardEl);

    // Show a shadow card underneath if there are more
    if (discardPile.length > 1) {
      const shadowCard = createCard(null, { faceUp: false });
      shadowCard.style.position = 'absolute';
      shadowCard.style.transform = 'translate(2px, 2px)';
      shadowCard.style.zIndex = '-1';
      stack.insertBefore(shadowCard, stack.firstChild);
    }
  } else {
    stack.innerHTML = '<div class="card-slot" style="opacity:0.3"><span>Discard</span></div>';
  }

  const countLabel = document.createElement('div');
  countLabel.className = 'pile-count';
  countLabel.textContent = discardPile.length || '';
  countLabel.style.color = 'var(--text-muted)';

  const label = document.createElement('div');
  label.className = 'pile-label';
  label.textContent = 'Discard';

  container.appendChild(stack);
  container.appendChild(countLabel);
  container.appendChild(label);

  return container;
}

export default { createDiscardPile };
