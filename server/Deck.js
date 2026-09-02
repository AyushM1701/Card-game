// server/Deck.js — Deck creation, shuffle, and card utilities

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const VALUE_MAP = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

const ACTION_RANKS = new Set(['7', 'J', 'Q', 'K']);

/**
 * Create a deck of cards. For 5+ players, use numDecks=2.
 * @param {number} numDecks Number of standard 52-card decks to combine
 * @returns {Array<{id: string, suit: string, rank: string, value: number}>}
 */
export function createDeck(numDecks = 1) {
  const cards = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${rank}_${suit}_${d}`,
          suit,
          rank,
          value: VALUE_MAP[rank]
        });
      }
    }
  }
  return cards;
}

/**
 * Fisher-Yates shuffle (in-place).
 * @param {Array} cards
 * @returns {Array}
 */
export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * Draw the top card from the pile.
 * @param {Array} pile
 * @returns {object|null} The drawn card, or null if pile is empty
 */
export function draw(pile) {
  if (pile.length === 0) return null;
  return pile.pop();
}

/**
 * Get the numeric value of a card.
 * @param {object} card
 * @returns {number}
 */
export function getCardValue(card) {
  return VALUE_MAP[card.rank] || 0;
}

/**
 * Check if a card is an action card (7, J, Q, K).
 * @param {object} card
 * @returns {boolean}
 */
export function isActionCard(card) {
  return ACTION_RANKS.has(card.rank);
}

/**
 * Get the action type for an action card.
 * @param {object} card
 * @returns {string|null} 'scramble' | 'blind-trade' | 'peek-opponent' | 'peek-own' | null
 */
export function getActionType(card) {
  switch (card.rank) {
    case '7': return 'scramble';
    case 'J': return 'blind-trade';
    case 'Q': return 'peek-opponent';
    case 'K': return 'peek-own';
    default: return null;
  }
}

/**
 * Get the suit symbol for display.
 */
export function getSuitSymbol(suit) {
  const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return symbols[suit] || suit;
}

/**
 * Format a card for logging/display.
 */
export function formatCard(card) {
  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

export default { createDeck, shuffle, draw, getCardValue, isActionCard, getActionType, getSuitSymbol, formatCard };
