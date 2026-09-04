// src/game/CardUtils.js — Shared card utilities (client-side mirror)

const VALUE_MAP = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

const SUIT_SYMBOLS = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
};

const RED_SUITS = new Set(['hearts', 'diamonds']);
const ACTION_RANKS = new Set(['7', 'J', 'Q', 'K']);

const ACTION_NAMES = {
  '7': 'Scramble',
  'J': 'Blind Trade',
  'Q': 'Peek Opponent',
  'K': 'Peek Own'
};

export function getCardValue(card) {
  return VALUE_MAP[card.rank] || 0;
}

export function getSuitSymbol(suit) {
  return SUIT_SYMBOLS[suit] || suit;
}

export function isRedSuit(suit) {
  return RED_SUITS.has(suit);
}

export function isActionCard(card) {
  return ACTION_RANKS.has(card.rank);
}

export function getActionName(card) {
  return ACTION_NAMES[card.rank] || null;
}

export function getActionType(card) {
  switch (card.rank) {
    case '7': return 'scramble';
    case 'J': return 'blind-trade';
    case 'Q': return 'peek-opponent';
    case 'K': return 'peek-own';
    default: return null;
  }
}



export function formatCard(card) {
  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

export function getTotalValue(cards) {
  return cards.reduce((sum, c) => sum + getCardValue(c), 0);
}
