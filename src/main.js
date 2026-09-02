// src/main.js — App entry point, router & socket bootstrap

import socketClient from './game/SocketClient.js';
import clientState from './game/ClientState.js';
import { renderLobbyScreen } from './screens/LobbyScreen.js';
import { renderWaitingRoom } from './screens/WaitingRoom.js';
import { renderGameScreen } from './screens/GameScreen.js';
import { renderResultsScreen } from './screens/ResultsScreen.js';
import { renderHowToPlayScreen } from './screens/HowToPlayScreen.js';
import { showToast } from './components/Toast.js';

// ─── Router ────────────────────────────────────────────
const screens = {
  lobby: renderLobbyScreen,
  waiting: renderWaitingRoom,
  game: renderGameScreen,
  results: renderResultsScreen,
  'how-to-play': renderHowToPlayScreen
};

function navigate(screen) {
  console.log(`[Router] Navigating to: ${screen}`);
  clientState.screen = screen;
  const renderer = screens[screen];
  if (renderer) {
    renderer(navigate);
  }
}

// ─── Socket Connection ─────────────────────────────────
socketClient.connect();

socketClient.on('_connected', () => {
  console.log('[App] Socket connected');
});

socketClient.on('_disconnected', (reason) => {
  showToast('Connection lost. Reconnecting...', { type: 'error', icon: '🔌' });
});

socketClient.on('_error', (err) => {
  showToast('Connection error. Retrying...', { type: 'error' });
});

// ─── Global Game Events ────────────────────────────────
// These need to be registered once, not per-screen

socketClient.on('game-started', (data) => {
  clientState.startGame(data);
  navigate('game');
});

// ─── Reconnection on Boot ──────────────────────────────
const savedSession = clientState.getSavedSession();

if (savedSession) {
  let attempted = false;
  const attemptReconnect = () => {
    if (attempted) return;
    attempted = true;

    socketClient.emit('reconnect-room', {
      roomCode: savedSession.roomCode,
      playerId: savedSession.playerId,
      reconnectToken: savedSession.reconnectToken
    }, (res) => {
      if (res && res.success) {
        clientState.resumeGame(
          res.roomCode,
          res.playerId,
          res.players,
          res.isHost,
          res.isSpectator,
          res.totalRounds,
          res.gameView,
          res.reconnectToken || savedSession.reconnectToken
        );

        if (res.status === 'playing') {
          navigate('game');
        } else {
          navigate('waiting');
        }
        showToast('Reconnected to game!', { type: 'success', icon: '🔌' });
      } else {
        clientState.clearSession();
        navigate('lobby');
      }
    });
  };

  if (socketClient.connected) {
    attemptReconnect();
  } else {
    socketClient.on('_connected', attemptReconnect);
    // Timeout fallback if socket connection doesn't happen quickly (10s matches socket timeout)
    setTimeout(() => {
      if (!attempted && !clientState.roomCode) {
        navigate('lobby');
      }
    }, 10000);
  }
} else {
  // Initialize default lobby
  navigate('lobby');
}

console.log('🃏 MIND F*CK loaded');
