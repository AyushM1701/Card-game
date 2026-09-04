// server/tests/roomManager.test.js — RoomManager Unit Tests
import test from 'node:test';
import assert from 'node:assert/strict';
import RoomManager from '../RoomManager.js';

test('RoomManager — Room creation and name sanitization', () => {
  const rm = new RoomManager();

  // Test name sanitization
  const room = rm.createRoom('  <script>Alice</script>  ', 'sock_1', 4, 3);
  assert.ok(room.code);
  assert.equal(room.code.length, 6);
  assert.equal(room.players[0].name, 'Alice');
  assert.equal(room.players[0].isHost, true);
  assert.ok(room.players[0].reconnectToken);
  assert.equal(typeof room.players[0].reconnectToken, 'string');
});

test('RoomManager — Reconnection Token Security', () => {
  const rm = new RoomManager();
  const room = rm.createRoom('Alice', 'sock_1', 4, 1);
  const host = room.players[0];
  const originalToken = host.reconnectToken;

  // Set game to playing so player seat is preserved across disconnect
  room.status = 'playing';

  // Simulate disconnect
  rm.handleDisconnect('sock_1');

  // Attempt reconnect with WRONG token -> must be rejected
  const fakeTokenReconnect = rm.reconnectPlayer(room.code, host.id, 'sock_new', 'wrong-token-12345');
  assert.equal(fakeTokenReconnect, null);

  // Attempt reconnect with NULL or UNDEFINED token -> must be rejected
  assert.equal(rm.reconnectPlayer(room.code, host.id, 'sock_new', null), null);
  assert.equal(rm.reconnectPlayer(room.code, host.id, 'sock_new', undefined), null);

  // Attempt joinRoom reconnect with NULL token -> must fail
  const joinWithNullToken = rm.joinRoom(room.code, 'Alice', 'sock_new', host.id, null);
  assert.equal(joinWithNullToken.success, false);
  assert.equal(joinWithNullToken.error, 'Unauthorized reconnection attempt.');

  // Attempt reconnect with CORRECT token -> must succeed
  const validReconnect = rm.reconnectPlayer(room.code, host.id, 'sock_new', originalToken);
  assert.ok(validReconnect);
  assert.equal(validReconnect.player.id, host.id);
  assert.equal(validReconnect.player.socketId, 'sock_new');
  assert.equal(validReconnect.player.connected, true);
});

test('RoomManager — Bot Addition and Removal', () => {
  const rm = new RoomManager();
  const room = rm.createRoom('HostPlayer', 'sock_1', 3, 1);

  // Add 2 bots
  const bot1 = rm.addBot(room.code, 'Bot 1');
  assert.ok(bot1);
  assert.equal(bot1.isBot, true);
  assert.equal(room.players.length, 2);

  const bot2 = rm.addBot(room.code, 'Bot 2');
  assert.ok(bot2);
  assert.equal(room.players.length, 3);

  // Room is now full (maxPlayers = 3)
  const bot3 = rm.addBot(room.code, 'Bot 3');
  assert.equal(bot3, null);

  // Remove bot1
  const removed = rm.removeBot(room.code, bot1.id);
  assert.equal(removed, true);
  assert.equal(room.players.length, 2);
  assert.equal(room.players.some(p => p.id === bot1.id), false);
});

test('RoomManager — Lowercase room code lookup and disconnect handling', () => {
  const rm = new RoomManager();
  const room = rm.createRoom('HostPlayer', 'sock_host', 4, 1);

  // Guest joins with lowercase room code
  const joinRes = rm.joinRoom(room.code.toLowerCase(), 'GuestPlayer', 'sock_guest');
  assert.ok(joinRes.success);
  assert.equal(joinRes.room.code, room.code);

  // getRoomBySocket must resolve room even when joined via lowercase
  const socketRoom = rm.getRoomBySocket('sock_guest');
  assert.ok(socketRoom);
  assert.equal(socketRoom.code, room.code);

  // handleDisconnect must resolve room even when joined via lowercase
  const dcRes = rm.handleDisconnect('sock_guest');
  assert.ok(dcRes);
  assert.equal(dcRes.roomCode, room.code);
});

test('RoomManager — Fresh playerId generation for new joins (No Client ID Spoofing)', () => {
  const rm = new RoomManager();
  const room = rm.createRoom('HostPlayer', 'sock_host', 4, 1);

  // Client attempts to pass an arbitrary playerId during initial join
  const joinRes = rm.joinRoom(room.code, 'GuestPlayer', 'sock_guest', 'client_spoofed_id_999');
  assert.ok(joinRes.success);
  // Server must NOT adopt client-provided ID for new player instances
  assert.notEqual(joinRes.player.id, 'client_spoofed_id_999');
  assert.ok(joinRes.player.id.length > 20); // Valid UUID
});

