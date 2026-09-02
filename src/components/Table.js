// src/components/Table.js — Round green velvet table with dynamic user-centric seats

import { createSeat } from './Seat.js';
import { createDrawPile } from './DrawPile.js';
import { createDiscardPile } from './DiscardPile.js';
import clientState from '../game/ClientState.js';

/**
 * Create the full game table with all seats and center piles.
 * @param {Function} onDraw - callback when draw pile is clicked
 * @returns {HTMLElement}
 */
export function createTable(onDraw, onCardClick = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'game-table-wrapper';

  const table = document.createElement('div');
  table.className = 'table';
  table.id = 'game-table';

  // Center area — draw and discard piles
  const center = document.createElement('div');
  center.className = 'table-center';
  center.id = 'table-center';

  const drawPile = createDrawPile(
    clientState.drawPileCount,
    clientState.isMyTurn && !clientState.drawnCard && !clientState.isSpectator,
    onDraw
  );
  drawPile.id = 'draw-pile';

  const discardPile = createDiscardPile(clientState.discardPile);
  discardPile.id = 'discard-pile';

  center.appendChild(drawPile);
  center.appendChild(discardPile);
  table.appendChild(center);

  // Seats container
  const seatsContainer = document.createElement('div');
  seatsContainer.className = 'seats-container';
  seatsContainer.id = 'seats-container';

  const players = clientState.players;
  const numPlayers = players.length;

  // Find index of current user so 'YOU' is always positioned at bottom center (6 o'clock)
  const myIndex = players.findIndex(p => p.id === clientState.playerId);

  players.forEach((player, index) => {
    // Relative position so current user is always index 0 (bottom of screen)
    const relativeIndex = myIndex !== -1
      ? (index - myIndex + numPlayers) % numPlayers
      : index;

    // Angle: bottom is +Math.PI / 2 (90 deg / 6 o'clock)
    // Clockwise distribution around the circle:
    const angle = (Math.PI / 2) + (2 * Math.PI * relativeIndex) / numPlayers;

    const isCurrentTurn = player.id === clientState.currentPlayerId;
    const isMe = player.id === clientState.playerId;
    const seat = createSeat(player, angle, isCurrentTurn, isMe ? onCardClick : null);
    seatsContainer.appendChild(seat);
  });

  table.appendChild(seatsContainer);
  wrapper.appendChild(table);

  return wrapper;
}

/**
 * Update just the center piles (draw + discard).
 */
export function updateTableCenter(onDraw) {
  const center = document.getElementById('table-center');
  if (!center) return;
  center.innerHTML = '';

  const drawPile = createDrawPile(
    clientState.drawPileCount,
    clientState.isMyTurn && !clientState.drawnCard && !clientState.isSpectator,
    onDraw
  );
  drawPile.id = 'draw-pile';

  const discardPile = createDiscardPile(clientState.discardPile);
  discardPile.id = 'discard-pile';

  center.appendChild(drawPile);
  center.appendChild(discardPile);
}

/**
 * Update seat highlights (turn indicator).
 */
export function updateSeatHighlights() {
  const seats = document.querySelectorAll('.seat');
  seats.forEach(seat => {
    const playerId = seat.id.replace('seat-', '');
    const isCurrentTurn = playerId === clientState.currentPlayerId;

    seat.classList.toggle('seat-active-turn', isCurrentTurn);

    const nameTag = seat.querySelector('.player-name-tag');
    if (nameTag) {
      nameTag.classList.toggle('active-turn', isCurrentTurn);
    }
  });
}

export default { createTable, updateTableCenter, updateSeatHighlights };
