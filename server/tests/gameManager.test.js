// server/tests/gameManager.test.js — GameManager Unit Tests
import test from 'node:test';
import assert from 'node:assert/strict';
import GameManager from '../GameManager.js';
import RoomManager from '../RoomManager.js';

test('GameManager — Initialization and Dealing', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 3);
  rm.addBot(room.code, 'BotBob');

  const game = gm.startGame(room);

  assert.equal(game.phase, 'peek_phase');
  assert.equal(game.roundNumber, 1);
  assert.equal(game.totalRounds, 3);
  assert.equal(game.playerOrder.length, 2);

  // Each player dealt 3 cards
  for (const pid of game.playerOrder) {
    assert.equal(game.hands[pid].cards.length, 3);
    for (const card of game.hands[pid].cards) {
      assert.ok(card.suit);
      assert.ok(card.value);
    }
  }

  // Draw pile count should be 52 - 6 = 46 cards
  assert.equal(game.drawPile.length, 46);
  assert.equal(game.discardPile.length, 0);
});

test('GameManager — Peek phase transition', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  assert.equal(gm.getGame(room.code).phase, 'peek_phase');

  // Bot finishes peek
  const botPeek = gm.markPeekDone(room.code, bot.id);
  assert.equal(botPeek, false); // Alice has not finished yet
  assert.equal(gm.getGame(room.code).phase, 'peek_phase');

  // Alice finishes peek
  const alicePeek = gm.markPeekDone(room.code, p1);
  assert.equal(alicePeek, true); // All done!
  assert.equal(gm.getGame(room.code).phase, 'playing');
});

test('GameManager — Card Drawing and Turn Validation', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  // Wrong player cannot draw
  const invalidDraw = gm.drawCard(room.code, bot.id);
  assert.equal(invalidDraw, null);

  // Current player draws
  const drawRes = gm.drawCard(room.code, p1);
  assert.ok(drawRes);
  assert.ok(drawRes.card);
  assert.equal(drawRes.pileCount, 45);

  // Cannot draw twice while holding a drawn card
  const secondDraw = gm.drawCard(room.code, p1);
  assert.equal(secondDraw, null);
});

test('GameManager — Swap Card Rules', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);

  // Manually set hand for controlled testing
  // Slot 0: 5 of Hearts, Slot 1: King of Spades (13), Slot 2: 2 of Diamonds
  game.hands[p1].cards = [
    { suit: 'hearts', value: 5, rank: '5' },
    { suit: 'spades', value: 13, rank: 'K' },
    { suit: 'diamonds', value: 2, rank: '2' }
  ];

  // Test 1: Plain card (4) swapped into slot 0 (value 5) -> 4 < 5 -> SUCCEEDS
  game.drawnCard = { suit: 'clubs', value: 4, rank: '4' };
  game.drawnByPlayerId = p1;
  const swapSuccess = gm.swapCard(room.code, p1, 0);
  assert.equal(swapSuccess.success, true);
  assert.equal(swapSuccess.displaced.value, 5);
  assert.equal(game.hands[p1].cards[0].value, 4);
  assert.equal(game.discardPile.length, 1);

  // Test 2: Plain card (8) swapped into slot 0 (value 4) -> 8 >= 4 -> FAILS
  game.drawnCard = { suit: 'clubs', value: 8, rank: '8' };
  game.drawnByPlayerId = p1;
  const swapFail = gm.swapCard(room.code, p1, 0);
  assert.equal(swapFail.success, false);
  assert.match(swapFail.error, /must be lower/i);

  // Test 3: Action card (Queen = 12) banked into slot 2 (value 2) -> Action banking always allowed
  game.drawnCard = { suit: 'hearts', value: 12, rank: 'Q' };
  game.drawnByPlayerId = p1;
  const bankSuccess = gm.swapCard(room.code, p1, 2);
  assert.equal(bankSuccess.success, true);
  assert.equal(game.hands[p1].cards[2].rank, 'Q');

  // Test 4: Swapping displaced action card triggers action
  // Displacing slot 1 (King = 13) with plain 3
  game.drawnCard = { suit: 'spades', value: 3, rank: '3' };
  game.drawnByPlayerId = p1;
  const displaceKing = gm.swapCard(room.code, p1, 1);
  assert.equal(displaceKing.success, true);
  assert.equal(displaceKing.actionTriggered, 'peek-own');
  assert.equal(game.pendingAction.type, 'peek-own');
});

test('GameManager — Multi-Round Match Lifecycle (isMatchOver test)', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 3); // 3-round match
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  const game = gm.getGame(room.code);

  // Round 1
  assert.equal(game.roundNumber, 1);
  assert.equal(game.totalRounds, 3);
  assert.equal(gm.isMatchOver(room.code), false);

  // End Round 1
  game.drawPile = [];
  gm._endRound(room.code);
  const r1Results = gm.getRoundResults(room.code);
  assert.equal(r1Results.roundNumber, 1);
  assert.equal(r1Results.isMatchOver, false);

  // Start Round 2
  gm.startNextRound(room);
  assert.equal(game.roundNumber, 2);
  assert.equal(gm.isMatchOver(room.code), false);

  // End Round 2
  game.drawPile = [];
  gm._endRound(room.code);
  const r2Results = gm.getRoundResults(room.code);
  assert.equal(r2Results.roundNumber, 2);
  assert.equal(r2Results.isMatchOver, false);

  // Start Round 3
  gm.startNextRound(room);
  assert.equal(game.roundNumber, 3);
  // During round 3, match is not over until round 3 completes
  assert.equal(gm.isMatchOver(room.code), true); // At round 3, roundNumber >= totalRounds is true

  // End Round 3
  game.drawPile = [];
  gm._endRound(room.code);
  const r3Results = gm.getRoundResults(room.code);
  assert.equal(r3Results.roundNumber, 3);
  assert.equal(r3Results.isMatchOver, true);
});
