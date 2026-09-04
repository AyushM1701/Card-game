// server/tests/clientState.test.js — ClientState Unit Tests
import test from 'node:test';
import assert from 'node:assert/strict';
import clientState from '../../src/game/ClientState.js';

test('ClientState (F1 regression) — startGame clears discardPile, drawnCard, pendingAction, and roundResults', () => {
  clientState.reset();

  // Simulate prior round state
  clientState.discardPile = [{ suit: 'hearts', value: 7, rank: '7' }];
  clientState.drawnCard = { suit: 'spades', value: 10, rank: '10' };
  clientState.pendingAction = { type: 'jack_swap', triggeredBy: 'player1' };
  clientState.roundResults = { winner: 'player1', playerResults: [] };

  // Call startGame for round 2
  clientState.startGame({
    phase: 'peek_phase',
    myCards: [{ suit: 'diamonds', value: 2, rank: '2' }],
    playerOrder: ['p1', 'p2'],
    players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
    drawPileCount: 40,
    currentPlayerId: 'p1',
    roundNumber: 2,
    totalRounds: 3
  });

  // Verify prior round state was purged
  assert.deepEqual(clientState.discardPile, [], 'discardPile must be reset to empty array');
  assert.equal(clientState.drawnCard, null, 'drawnCard must be reset to null');
  assert.equal(clientState.pendingAction, null, 'pendingAction must be reset to null');
  assert.equal(clientState.roundResults, null, 'roundResults must be reset to null');
  assert.equal(clientState.roundNumber, 2);
  assert.equal(clientState.phase, 'peek_phase');
});
