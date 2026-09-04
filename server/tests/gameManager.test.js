// server/tests/gameManager.test.js — GameManager Unit Tests
import test from 'node:test';
import assert from 'node:assert/strict';
import GameManager from '../GameManager.js';
import RoomManager from '../RoomManager.js';
import setupSocketHandlers from '../socketHandlers.js';

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

  // Test 2: Any card can replace any slot — no value restriction (high-risk mechanic)
  game.drawnCard = { suit: 'clubs', value: 8, rank: '8' };
  game.drawnByPlayerId = p1;
  const swapHigher = gm.swapCard(room.code, p1, 0);
  assert.equal(swapHigher.success, true); // Higher-value card is accepted — any swap allowed
  assert.equal(game.hands[p1].cards[0].value, 8);
  assert.equal(game.discardPile.length, 2); // displaced 4 goes to discard

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
  // While round 3 is in progress, match is not yet over
  assert.equal(gm.isMatchOver(room.code), false);

  // End Round 3
  game.drawPile = [];
  gm._endRound(room.code);
  const r3Results = gm.getRoundResults(room.code);
  assert.equal(r3Results.roundNumber, 3);
  assert.equal(r3Results.isMatchOver, true);
  assert.equal(gm.isMatchOver(room.code), true);

  // Cannot start round 4 when totalRounds is 3
  const extraRound = gm.startNextRound(room);
  assert.equal(extraRound, null);
});

test('GameManager — Action resolution does not clear pendingAction until finishActionAndAdvance', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);
  game.pendingAction = { type: 'peek-own', playerId: p1, isTriggered: false };
  const initialIndex = game.currentPlayerIndex;

  // Resolving peek own returns cards but leaves pendingAction intact until finishActionAndAdvance
  const cards = gm.resolvePeekOwn(room.code, p1);
  assert.ok(cards);
  assert.notEqual(game.pendingAction, null);
  assert.equal(game.currentPlayerIndex, initialIndex);

  // finishActionAndAdvance clears pendingAction and advances turn
  gm.finishActionAndAdvance(room.code);
  assert.equal(game.pendingAction, null);
  assert.equal(game.currentPlayerIndex, (initialIndex + 1) % 2);
});

test('GameManager — Empty draw pile immediately ends round without ghost turn advance', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);
  game.drawPile = [];
  const currentIndex = game.currentPlayerIndex;

  gm._advanceTurn(room.code);

  assert.equal(game.phase, 'round_over');
  assert.equal(game.currentPlayerIndex, currentIndex);
});

test('GameManager — Tied lowest round totals mark all tied players as winners', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);
  // Both players have identical total score of 8
  game.hands[p1].cards = [
    { suit: 'hearts', value: 2, rank: '2' },
    { suit: 'spades', value: 3, rank: '3' },
    { suit: 'diamonds', value: 3, rank: '3' }
  ];
  game.hands[bot.id].cards = [
    { suit: 'clubs', value: 1, rank: 'A' },
    { suit: 'hearts', value: 3, rank: '3' },
    { suit: 'spades', value: 4, rank: '4' }
  ];

  game.drawPile = [];
  gm._endRound(room.code);

  const roundResults = gm.getRoundResults(room.code);
  assert.ok(roundResults);
  assert.equal(roundResults.playerResults.length, 2);
  assert.equal(roundResults.playerResults[0].roundTotal, 8);
  assert.equal(roundResults.playerResults[1].roundTotal, 8);
  assert.equal(roundResults.playerResults[0].isWinner, true);
  assert.equal(roundResults.playerResults[1].isWinner, true);
});

test('GameManager — playActionImmediately returns discarded action card', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);
  const kingCard = { id: 'K_hearts_0', rank: 'K', suit: 'hearts', value: 13 };
  game.drawnCard = kingCard;
  game.drawnByPlayerId = p1;

  const result = gm.playActionImmediately(room.code, p1);
  assert.equal(result.success, true);
  assert.equal(result.actionType, 'peek-own');
  assert.ok(result.card);
  assert.equal(result.card.rank, 'K');
  assert.equal(result.card.suit, 'hearts');
  assert.equal(game.discardPile.length, 1);
  assert.equal(game.discardPile[0].rank, 'K');
});

test('GameManager — startNextRound refreshes playerOrder and scores for new player list', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 2);
  const bot = rm.addBot(room.code, 'BotBob');

  const game = gm.startGame(room);
  assert.equal(game.roundNumber, 1);

  // End round 1
  game.phase = 'round_over';

  // Add another bot for round 2
  const bot2 = { id: 'bot_fresh', name: 'BotFresh', connected: true, isBot: true };
  room.players.push(bot2);

  const nextGame = gm.startNextRound(room);
  assert.ok(nextGame);
  assert.equal(nextGame.roundNumber, 2);
  assert.equal(nextGame.playerOrder.includes('bot_fresh'), true);
  assert.equal(nextGame.scores['bot_fresh'], 0);
});

test('GameManager — _endRound idempotency prevents duplicate score accumulation', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'socket_1', 4, 1);
  const p1 = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, p1);
  gm.markPeekDone(room.code, bot.id);

  const game = gm.getGame(room.code);
  game.hands[p1].cards = [
    { suit: 'hearts', value: 2, rank: '2' },
    { suit: 'spades', value: 3, rank: '3' },
    { suit: 'diamonds', value: 4, rank: '4' }
  ]; // Total: 9
  game.hands[bot.id].cards = [
    { suit: 'clubs', value: 5, rank: '5' },
    { suit: 'hearts', value: 5, rank: '5' },
    { suit: 'spades', value: 5, rank: '5' }
  ]; // Total: 15

  // First invocation
  gm._endRound(room.code);
  assert.equal(game.phase, 'round_over');
  assert.equal(game.scores[p1], 9);
  assert.equal(game.scores[bot.id], 15);

  // Second invocation (simulate duplicate trigger from drawCard + finishActionAndAdvance)
  gm._endRound(room.code);
  assert.equal(game.scores[p1], 9, 'Scores must not be added a second time');
  assert.equal(game.scores[bot.id], 15, 'Scores must not be added a second time');
});

test('socketHandlers — arms game.turnTimer when starting player is a connected human', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_alice', 4, 1);
  const bot = rm.addBot(room.code, 'BotBob');

  const game = gm.startGame(room);
  assert.equal(game.phase, 'peek_phase');
  assert.equal(game.turnTimer, null);

  const eventHandlers = new Map();
  const socket = {
    id: 'sock_alice',
    join: () => {},
    on: (evt, handler) => { eventHandlers.set(evt, handler); },
    emit: () => {}
  };

  let connectionHandler;
  const mockIo = {
    on: (evt, handler) => {
      if (evt === 'connection') connectionHandler = handler;
    },
    to: () => ({ emit: () => {} })
  };

  setupSocketHandlers(mockIo, rm, gm);
  assert.ok(connectionHandler);
  connectionHandler(socket);

  // Bot peek is marked done
  gm.markPeekDone(room.code, bot.id);

  // Alice emits peek-done
  const peekDoneHandler = eventHandlers.get('peek-done');
  assert.ok(peekDoneHandler);
  peekDoneHandler();

  // Phase should now be playing and turnTimer should be armed for connected human Alice
  assert.equal(game.phase, 'playing');
  assert.ok(game.turnTimer !== null, 'Turn 1 idle timeout must be armed for connected human starting player');

  // Clean up timer so test runner can exit cleanly
  clearTimeout(game.turnTimer);
  game.turnTimer = null;
});

test('GameManager — getPlayerView includes roundResults when phase is round_over', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_1', 4, 1);
  const bot = rm.addBot(room.code, 'BotBob');

  gm.startGame(room);
  gm.markPeekDone(room.code, room.players[0].id);
  gm.markPeekDone(room.code, bot.id);

  // During playing phase, roundResults is not present
  const playingView = gm.getPlayerView(room.code, room.players[0].id);
  assert.equal(playingView.roundResults, undefined);

  // End the round
  gm._endRound(room.code);

  const roundOverView = gm.getPlayerView(room.code, room.players[0].id);
  assert.equal(roundOverView.phase, 'round_over');
  assert.ok(roundOverView.roundResults, 'roundResults must be included in round_over playerView');
  assert.equal(roundOverView.roundResults.playerResults.length, 2);
});

test('socketHandlers — request-rematch resets room state and emits room-rematch-started', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_host', 4, 1);
  const bot = rm.addBot(room.code, 'BotBob');

  const game = gm.startGame(room);
  room.status = 'playing';

  const eventHandlers = new Map();
  const socket = {
    id: 'sock_host',
    join: () => {},
    on: (evt, handler) => { eventHandlers.set(evt, handler); },
    emit: () => {}
  };

  const emittedToRoom = [];
  const mockIo = {
    on: (evt, handler) => {
      if (evt === 'connection') handler(socket);
    },
    to: (targetRoom) => ({
      emit: (evt, payload) => {
        emittedToRoom.push({ targetRoom, evt, payload });
      }
    })
  };

  setupSocketHandlers(mockIo, rm, gm);

  const requestRematchHandler = eventHandlers.get('request-rematch');
  assert.ok(requestRematchHandler);

  let cbResult;
  requestRematchHandler(null, (res) => { cbResult = res; });

  assert.deepEqual(cbResult, { success: true });
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  assert.equal(gm.getGame(room.code), null);

  const rematchEvent = emittedToRoom.find(e => e.evt === 'room-rematch-started');
  assert.ok(rematchEvent);
  assert.equal(rematchEvent.payload.roomCode, room.code);
  assert.equal(rematchEvent.payload.players.length, 2);
});

test('socketHandlers (B1 regression) — human-starting-player peek-phase completion via disconnect auto-peek fires turn-change and arms timer', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_alice', 4, 1);
  const bob = rm.joinRoom(room.code, 'Bob', 'sock_bob');

  const game = gm.startGame(room);
  room.status = 'playing';

  // Ensure Alice is the first player
  if (game.playerOrder[0] !== room.players[0].id) {
    game.playerOrder = [room.players[0].id, room.players[1].id];
    game.currentPlayerIndex = 0;
  }

  const emittedToRoom = [];
  let connectionHandler;
  const mockIo = {
    on: (evt, handler) => {
      if (evt === 'connection') connectionHandler = handler;
    },
    to: (targetRoom) => ({
      emit: (evt, payload) => {
        emittedToRoom.push({ targetRoom, evt, payload });
      }
    })
  };

  setupSocketHandlers(mockIo, rm, gm);

  const aliceHandlers = new Map();
  const bobHandlers = new Map();
  connectionHandler({
    id: 'sock_alice',
    join: () => {},
    on: (evt, h) => { aliceHandlers.set(evt, h); },
    emit: () => {}
  });
  connectionHandler({
    id: 'sock_bob',
    join: () => {},
    on: (evt, h) => { bobHandlers.set(evt, h); },
    emit: () => {}
  });

  // Alice completes her peek
  gm.markPeekDone(room.code, room.players[0].id);

  // Bob disconnects during peek phase, completing the peek phase
  const bobDisconnectHandler = bobHandlers.get('disconnect');
  assert.ok(bobDisconnectHandler);
  bobDisconnectHandler();

  assert.equal(game.phase, 'playing');
  const peekCompleteEvt = emittedToRoom.find(e => e.evt === 'peek-phase-complete');
  assert.ok(peekCompleteEvt, 'peek-phase-complete event must be emitted');

  const turnChangeEvt = emittedToRoom.find(e => e.evt === 'turn-change');
  assert.ok(turnChangeEvt, 'turn-change event must be emitted when starting player is human');
  assert.equal(turnChangeEvt.payload.currentPlayerId, room.players[0].id);
  assert.ok(game.turnTimer !== null, 'turnTimer must be armed for connected human starting player');

  // Clean up
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
});

test('socketHandlers (B2 regression) — current-player disconnect mid-turn clears 45s idle timer and arms grace period timer', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_alice', 4, 1);
  const bob = rm.joinRoom(room.code, 'Bob', 'sock_bob');

  const game = gm.startGame(room);
  room.status = 'playing';

  // Ensure Alice is the first player
  if (game.playerOrder[0] !== room.players[0].id) {
    game.playerOrder = [room.players[0].id, room.players[1].id];
    game.currentPlayerIndex = 0;
  }

  const emittedToRoom = [];
  let connectionHandler;
  const mockIo = {
    on: (evt, handler) => {
      if (evt === 'connection') connectionHandler = handler;
    },
    to: (targetRoom) => ({
      emit: (evt, payload) => {
        emittedToRoom.push({ targetRoom, evt, payload });
      }
    })
  };

  setupSocketHandlers(mockIo, rm, gm);

  const aliceHandlers = new Map();
  connectionHandler({
    id: 'sock_alice',
    join: () => {},
    on: (evt, h) => { aliceHandlers.set(evt, h); },
    emit: () => {}
  });

  // Bob finishes peek, Alice completes peek via socket event to trigger turn 1
  gm.markPeekDone(room.code, room.players[1].id);

  // Trigger turn 1 for Alice which sets the 45s idle timer
  const peekDoneHandler = aliceHandlers.get('peek-done');
  peekDoneHandler();

  assert.equal(game.phase, 'playing');
  assert.ok(game.turnTimer !== null, 'Initial 45s idle timer must be armed for Alice');
  const initialTimer = game.turnTimer;

  // Mid-turn, Alice (current player) disconnects
  const aliceDisconnectHandler = aliceHandlers.get('disconnect');
  assert.ok(aliceDisconnectHandler);
  aliceDisconnectHandler();

  // The old 45s timer must have been replaced with a grace-period timer
  assert.ok(game.turnTimer !== null, 'New grace period timer must be armed');
  assert.notEqual(game.turnTimer, initialTimer, 'Old 45s timer must have been cleared and replaced');

  const warningEvt = emittedToRoom.find(e => e.evt === 'turn-timer-warning');
  assert.ok(warningEvt, 'turn-timer-warning event must be emitted');
  assert.equal(warningEvt.payload.playerId, room.players[0].id);
  assert.equal(warningEvt.payload.seconds, 6);

  // Clean up
  if (game.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
});

test('socketHandlers (B3 regression) — request-rematch purges disconnected players and re-indexes seats', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_alice', 4, 1);
  rm.joinRoom(room.code, 'Bob', 'sock_bob');
  rm.joinRoom(room.code, 'Charlie', 'sock_charlie');

  const game = gm.startGame(room);
  room.status = 'playing';

  // Bob disconnects during the match
  rm.handleDisconnect('sock_bob');
  assert.equal(room.players.length, 3);
  assert.equal(room.players[1].connected, false);

  const eventHandlers = new Map();
  const socket = {
    id: 'sock_alice',
    join: () => {},
    on: (evt, handler) => { eventHandlers.set(evt, handler); },
    emit: () => {}
  };

  const emittedToRoom = [];
  const mockIo = {
    on: (evt, handler) => {
      if (evt === 'connection') handler(socket);
    },
    to: (targetRoom) => ({
      emit: (evt, payload) => {
        emittedToRoom.push({ targetRoom, evt, payload });
      }
    })
  };

  setupSocketHandlers(mockIo, rm, gm);

  const requestRematchHandler = eventHandlers.get('request-rematch');
  assert.ok(requestRematchHandler);

  let cbResult;
  requestRematchHandler(null, (res) => { cbResult = res; });

  assert.deepEqual(cbResult, { success: true });
  assert.equal(room.status, 'waiting');

  // Assert disconnected players are purged and seats are re-indexed
  assert.equal(room.players.length, 2);
  assert.equal(room.players.some(p => p.name === 'Bob'), false, 'Disconnected player Bob must be purged');
  assert.equal(room.players[0].name, 'Alice');
  assert.equal(room.players[0].seatIndex, 0);
  assert.equal(room.players[1].name, 'Charlie');
  assert.equal(room.players[1].seatIndex, 1);
});







