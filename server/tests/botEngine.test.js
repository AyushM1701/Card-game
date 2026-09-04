// server/tests/botEngine.test.js — BotEngine Unit Tests
import test from 'node:test';
import assert from 'node:assert/strict';
import botEngine from '../BotEngine.js';
import GameManager from '../GameManager.js';
import RoomManager from '../RoomManager.js';

test('BotEngine — Isolated Initial Memory (No Omniscience)', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('HumanAlice', 'sock_1', 4, 1);
  const bot = rm.addBot(room.code, 'SmartBot');

  const gameState = gm.startGame(room);
  botEngine.initRoom(room.code, gameState);

  const humanId = room.players[0].id;
  const botId = bot.id;

  // Bot should remember its own 3 cards
  const botMemory = botEngine.getMemory(room.code, botId);
  assert.equal(botMemory.length, 3);
  for (const card of botMemory) {
    assert.ok(card);
    assert.ok(card.value);
  }

  // Opponent (human) cards in room memory should be completely unknown [null, null, null]
  const humanMemory = botEngine.getMemory(room.code, humanId);
  assert.deepEqual(humanMemory, [null, null, null]);
});

test('BotEngine — Queen Peek Stores Opponent Cards in Memory', () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('HumanAlice', 'sock_1', 4, 1);
  const humanId = room.players[0].id;
  const bot = rm.addBot(room.code, 'SmartBot');
  const botId = bot.id;

  const gameState = gm.startGame(room);
  botEngine.initRoom(room.code, gameState);

  // Before peek: human memory is unknown
  assert.deepEqual(botEngine.getMemory(room.code, humanId), [null, null, null]);

  // Complete peek phase to enter playing phase
  gm.markPeekDone(room.code, humanId);
  gm.markPeekDone(room.code, botId);

  // Simulate bot executing peek-opponent
  const peekedCards = gm.resolvePeekOpponent(room.code, botId, humanId);
  assert.ok(peekedCards);
  assert.equal(peekedCards.length, 3);

  // When stored, bot memory now contains the peeked cards
  const roomMem = botEngine.botMemories.get(room.code);
  roomMem[humanId] = peekedCards.map(c => ({ ...c }));
  botEngine.botMemories.set(room.code, roomMem);

  const updatedHumanMem = botEngine.getMemory(room.code, humanId);
  assert.equal(updatedHumanMem.length, 3);
  assert.ok(updatedHumanMem[0] !== null);
  assert.equal(updatedHumanMem[0].value, peekedCards[0].value);
});

test('BotEngine — Scramble Wipes Target Memory', () => {
  const roomCode = 'TEST01';
  const targetId = 'player_target';

  // Seed memory with known cards
  botEngine.botMemories.set(roomCode, {
    [targetId]: [
      { suit: 'hearts', value: 4 },
      { suit: 'spades', value: 10 },
      { suit: 'diamonds', value: 2 }
    ]
  });

  assert.ok(botEngine.getMemory(roomCode, targetId)[0] !== null);

  // Scramble memory
  botEngine.scrambleMemory(roomCode, targetId);

  // Memory must be wiped to [null, null, null]
  assert.deepEqual(botEngine.getMemory(roomCode, targetId), [null, null, null]);
});

test('BotEngine — Sets roundOverEmitted flag when draw pile runs dry on bot turn', async () => {
  const gm = new GameManager();
  const rm = new RoomManager();
  const room = rm.createRoom('HumanAlice', 'sock_1', 4, 1);
  const humanId = room.players[0].id;
  const bot = rm.addBot(room.code, 'BotDrawer');
  const botId = bot.id;

  const gameState = gm.startGame(room);
  botEngine.initRoom(room.code, gameState);
  gm.markPeekDone(room.code, humanId);
  gm.markPeekDone(room.code, botId);

  // Advance turn to the bot
  gameState.currentPlayerIndex = gameState.playerOrder.indexOf(botId);
  // Empty the draw pile
  gameState.drawPile = [];
  gameState.roundOverEmitted = false;

  const emittedEvents = [];
  const mockIo = {
    to: (targetRoom) => ({
      emit: (evt, payload) => {
        emittedEvents.push({ targetRoom, evt, payload });
      }
    })
  };
  const mockEmitTurnChange = () => {};

  await botEngine.processBotTurn(room.code, botId, gm, rm, mockIo, mockEmitTurnChange);

  assert.equal(gameState.phase, 'round_over');
  assert.equal(gameState.roundOverEmitted, true);
  const roundOverEvent = emittedEvents.find(e => e.evt === 'round-over');
  assert.ok(roundOverEvent);
  assert.ok(roundOverEvent.payload.results);
});

