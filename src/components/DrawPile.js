// src/components/DrawPile.js — Center draw pile component

import { createCardBack } from './Card.js';

/**
 * Create the draw pile element.
 * @param {number} count
 * @param {boolean} isMyTurn
 * @param {Function} onDraw
 */
export function createDrawPile(count, isMyTurn, onDraw) {
  const container = document.createElement('div');
  container.className = 'pile-container';

  const stack = document.createElement('div');
  stack.className = 'card-stack';
  if (isMyTurn) stack.classList.add('draw-pile-active');

  // Show up to 4 stacked card backs
  const stackSize = Math.min(count, 4);
  for (let i = 0; i < stackSize; i++) {
    const cardEl = createCardBack();
    stack.appendChild(cardEl);
  }

  if (count === 0) {
    stack.innerHTML = '<div class="card-slot" style="opacity:0.3"><span>Empty</span></div>';
  }

  if (isMyTurn && count > 0) {
    stack.addEventListener('click', onDraw);
    stack.style.cursor = 'pointer';
  }

  const countLabel = document.createElement('div');
  countLabel.className = 'pile-count';
  countLabel.textContent = count;

  const label = document.createElement('div');
  label.className = 'pile-label';
  label.textContent = 'Draw';

  container.appendChild(stack);
  container.appendChild(countLabel);
  container.appendChild(label);

  return container;
}

export default { createDrawPile };
