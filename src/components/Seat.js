// src/components/Seat.js — Player seat around the table

import { createCard, createCardBack } from './Card.js';
import clientState from '../game/ClientState.js';

/**
 * Create a seat element for a player.
 * @param {object} player - { id, name, seatIndex, connected, isHost, isBot }
 * @param {number} angle - angle in radians for positioning (Math.PI/2 is bottom)
 * @param {boolean} isCurrentTurn - whether it's this player's turn
 */
export function createSeat(player, angle, isCurrentTurn, onCardClick = null) {
  const isMe = player.id === clientState.playerId && !clientState.isSpectator;

  const seat = document.createElement('div');
  seat.className = `seat ${isCurrentTurn ? 'seat-active-turn' : ''} ${isMe ? 'seat-me' : ''}`;
  seat.id = `seat-${player.id}`;

  // Position along the table perimeter
  // Table radius is 50%, so 38.5% places seats right along felt edge, perfectly clear of center piles
  const isSideSeat = Math.abs(Math.cos(angle)) > 0.7;
  const radiusPct = isSideSeat ? 39 : 38;
  const x = 50 + radiusPct * Math.cos(angle);
  const y = 50 + radiusPct * Math.sin(angle);

  seat.style.left = `${x}%`;
  seat.style.top = `${y}%`;

  // Determine if seat is near the bottom half or top half for card/name stacking
  const isBottomHalf = Math.sin(angle) > 0.3;

  // Cards (fan of 3)
  const cardFan = document.createElement('div');
  cardFan.className = `card-fan ${isSideSeat ? 'side-seat-fan' : ''}`;

  if (isMe && clientState.knownCards) {
    // Show known cards as face-down back (memory game rules) with hover indicators
    const canInteract = isCurrentTurn && !!clientState.drawnCard;
    for (let i = 0; i < 3; i++) {
      const cardEl = createCardBack({ interactive: canInteract });
      cardEl.dataset.slotIndex = i;
      if (canInteract && onCardClick) {
        cardEl.style.cursor = 'pointer';
        cardEl.classList.add('card-swappable');
        cardEl.addEventListener('click', () => onCardClick(i));
      }
      cardFan.appendChild(cardEl);
    }
  } else {
    // Opponents / spectators: show 3 face-down cards with slot indexes
    for (let i = 0; i < 3; i++) {
      const cardEl = createCardBack();
      cardEl.dataset.slotIndex = i;
      cardFan.appendChild(cardEl);
    }
  }

  // Player name tag
  const nameTag = document.createElement('div');
  nameTag.className = `player-name-tag ${isCurrentTurn ? 'active-turn' : ''} ${isMe ? 'is-me' : ''}`;

  const dot = document.createElement('div');
  dot.className = `connection-dot ${player.connected ? '' : 'disconnected'}`;

  const avatar = document.createElement('span');
  avatar.className = 'seat-avatar';
  avatar.textContent = player.isBot ? '🤖' : player.name.charAt(0).toUpperCase();

  const nameSpan = document.createElement('span');
  nameSpan.className = 'seat-name-text';
  nameSpan.textContent = player.name;

  nameTag.appendChild(dot);
  nameTag.appendChild(avatar);
  nameTag.appendChild(nameSpan);

  if (isMe) {
    const youBadge = document.createElement('span');
    youBadge.className = 'you-badge';
    youBadge.textContent = 'YOU';
    nameTag.appendChild(youBadge);
  } else if (player.isBot) {
    const botBadge = document.createElement('span');
    botBadge.className = 'you-badge bot-badge';
    botBadge.textContent = 'BOT';
    nameTag.appendChild(botBadge);
  }

  if (player.isHost) {
    const hostBadge = document.createElement('span');
    hostBadge.className = 'host-crown';
    hostBadge.textContent = '👑';
    nameTag.appendChild(hostBadge);
  }

  // Layout stacking:
  // If in bottom half, name tag goes under cards. If in top half, name tag goes above cards.
  if (isBottomHalf) {
    seat.appendChild(cardFan);
    seat.appendChild(nameTag);
  } else {
    seat.appendChild(nameTag);
    seat.appendChild(cardFan);
  }

  return seat;
}

export default { createSeat };
