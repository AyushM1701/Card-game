// src/screens/WaitingRoom.js — Pre-game lobby after room creation/join

import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import { showToast } from '../components/Toast.js';

let waitingListeners = [];
let currentNavigate = null;

function cleanupWaitingListeners() {
  waitingListeners.forEach(({ event, handler }) => {
    socketClient.off(event, handler);
  });
  waitingListeners = [];
}

export { cleanupWaitingListeners };

function onSocket(event, handler) {
  socketClient.on(event, handler);
  waitingListeners.push({ event, handler });
}

/**
 * Render the waiting room screen.
 * @param {Function} navigate - (screen) => void
 */
export function renderWaitingRoom(navigate) {
  cleanupWaitingListeners(); // Remove old listeners before re-registering
  currentNavigate = navigate;
  const app = document.getElementById('app');
  app.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'waiting-room';

  // Title
  const title = document.createElement('h2');
  title.style.cssText = 'font-family:var(--font-heading);font-size:var(--fs-2xl);font-weight:600;color:var(--text-secondary);';
  title.textContent = 'Waiting for players...';
  screen.appendChild(title);

  // Room code display
  const codeWrapper = document.createElement('div');
  codeWrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:var(--space-md);';

  const codeLabel = document.createElement('div');
  codeLabel.className = 'label';
  codeLabel.textContent = 'Room Code';

  const codeDisplay = document.createElement('div');
  codeDisplay.className = 'room-code-display shimmer-text';
  codeDisplay.textContent = clientState.roomCode;

  const shareRow = document.createElement('div');
  shareRow.style.cssText = 'display:flex;gap:var(--space-sm);';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-sm';
  copyBtn.textContent = '📋 Copy Code';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(clientState.roomCode).then(() => {
      showToast('Room code copied!', { type: 'success' });
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋 Copy Code'; }, 2000);
    });
  });

  const shareLinkBtn = document.createElement('button');
  shareLinkBtn.className = 'btn btn-secondary btn-sm';
  shareLinkBtn.textContent = '🔗 Copy Link';
  shareLinkBtn.addEventListener('click', () => {
    const link = `${window.location.origin}${window.location.pathname}?code=${clientState.roomCode}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Invite link copied!', { type: 'success' });
      shareLinkBtn.textContent = '✅ Copied!';
      setTimeout(() => { shareLinkBtn.textContent = '🔗 Copy Link'; }, 2000);
    });
  });

  shareRow.appendChild(copyBtn);
  shareRow.appendChild(shareLinkBtn);

  codeWrapper.appendChild(codeLabel);
  codeWrapper.appendChild(codeDisplay);
  codeWrapper.appendChild(shareRow);
  screen.appendChild(codeWrapper);

  // Players grid
  const playersSection = document.createElement('div');
  playersSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:var(--space-md);';

  const playersLabel = document.createElement('div');
  playersLabel.className = 'label';
  playersLabel.id = 'players-count-label';
  playersLabel.textContent = `Players (${clientState.players.length}/${clientState.maxPlayers})`;

  const playersGrid = document.createElement('div');
  playersGrid.className = 'players-grid';
  playersGrid.id = 'players-grid';

  renderPlayerCards(playersGrid);

  playersSection.appendChild(playersLabel);
  playersSection.appendChild(playersGrid);
  screen.appendChild(playersSection);

  // Start button & Bot Controls (host only)
  if (clientState.isHost) {
    const hostControls = document.createElement('div');
    hostControls.style.cssText = 'display:flex;gap:var(--space-md);margin-top:var(--space-lg);flex-wrap:wrap;justify-content:center;';

    const addBotBtn = document.createElement('button');
    addBotBtn.className = 'btn btn-secondary btn-lg';
    addBotBtn.id = 'add-bot-btn';
    addBotBtn.textContent = '🤖 Add Bot';
    addBotBtn.disabled = clientState.players.length >= clientState.maxPlayers;
    addBotBtn.addEventListener('click', () => {
      socketClient.emit('add-bot', null, (res) => {
        if (res.success) {
          showToast(`${res.bot.name} joined the table!`, { type: 'success', icon: '🤖' });
        } else {
          showToast(res.error || 'Could not add bot', { type: 'warning' });
        }
      });
    });

    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn-primary btn-lg';
    startBtn.id = 'start-game-btn';
    startBtn.textContent = '🚀 Start Game';
    startBtn.disabled = clientState.players.length < 2;

    startBtn.addEventListener('click', () => {
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';

      socketClient.emit('start-game', null, (res) => {
        if (!res.success) {
          startBtn.disabled = false;
          startBtn.textContent = '🚀 Start Game';
          showToast(res.error || 'Failed to start game', { type: 'error' });
        }
      });
    });

    hostControls.appendChild(addBotBtn);
    hostControls.appendChild(startBtn);
    screen.appendChild(hostControls);
  } else {
    const waitingText = document.createElement('div');
    waitingText.style.cssText = 'font-size:var(--fs-sm);color:var(--text-muted);';
    waitingText.textContent = 'Waiting for host to start the game...';
    screen.appendChild(waitingText);
  }

  // Match details info pill
  const matchInfoPill = document.createElement('div');
  matchInfoPill.style.cssText = 'font-size:var(--fs-xs);color:var(--gold);background:hsla(43,85%,55%,0.1);padding:4px 12px;border-radius:var(--radius-full);border:1px solid hsla(43,85%,55%,0.2);';
  matchInfoPill.textContent = `🎯 Match Format: ${clientState.totalRounds > 1 ? `${clientState.totalRounds} Rounds Cumulative` : 'Single Round'}`;
  screen.appendChild(matchInfoPill);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost btn-sm';
  backBtn.textContent = '← Leave Room';
  backBtn.style.marginTop = 'var(--space-md)';
  backBtn.addEventListener('click', () => {
    cleanupWaitingListeners();
    socketClient.emit('leave-room', null, () => {});
    clientState.clearSession();
    clientState.reset();
    navigate('lobby');
  });
  screen.appendChild(backBtn);

  app.appendChild(screen);

  // Listen for player updates
  onSocket('player-joined', (data) => {
    clientState.updatePlayers(data.players);
    updateWaitingRoom();
    if (data.newPlayer) {
      showToast(`${data.newPlayer.name} joined!`, { type: 'success', icon: data.newPlayer.isBot ? '🤖' : '👋' });
    }
  });

  onSocket('player-disconnected', (data) => {
    clientState.updatePlayers(data.players);
    updateWaitingRoom();
    showToast(`${data.playerName} left`, { type: 'warning' });
  });
}

function renderPlayerCards(container) {
  container.innerHTML = '';
  const players = clientState.players;
  const max = clientState.maxPlayers;

  players.forEach((player, i) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.style.animationDelay = `${i * 100}ms`;
    card.style.position = 'relative';

    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    if (player.isBot) {
      avatar.textContent = '🤖';
      avatar.style.background = 'linear-gradient(135deg, hsl(280, 60%, 40%), hsl(280, 80%, 60%))';
    } else {
      avatar.textContent = player.name.charAt(0).toUpperCase();
    }

    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.name;

    card.appendChild(avatar);
    card.appendChild(name);

    if (player.isHost) {
      const badge = document.createElement('div');
      badge.className = 'host-badge';
      badge.textContent = '👑 HOST';
      card.appendChild(badge);
    }

    if (player.id === clientState.playerId) {
      const youBadge = document.createElement('div');
      youBadge.className = 'host-badge';
      youBadge.style.color = 'var(--success)';
      youBadge.style.background = 'hsla(145, 65%, 42%, 0.15)';
      youBadge.textContent = 'YOU';
      card.appendChild(youBadge);
    }

    if (player.isBot && clientState.isHost) {
      const removeBtn = document.createElement('button');
      removeBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--danger);color:white;font-size:10px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove bot';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        socketClient.emit('remove-bot', { botId: player.id }, (res) => {
          if (!res?.success) {
            showToast(res?.error || 'Could not remove bot', { type: 'warning' });
          }
        });
      });
      card.appendChild(removeBtn);
    }

    container.appendChild(card);
  });

  // Empty seats
  for (let i = players.length; i < max; i++) {
    const card = document.createElement('div');
    card.className = 'player-card empty-seat-card';

    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.textContent = '?';

    const name = document.createElement('div');
    name.className = 'player-name';
    name.style.color = 'var(--text-muted)';
    name.textContent = 'Empty';

    card.appendChild(avatar);
    card.appendChild(name);
    container.appendChild(card);
  }
}

function updateWaitingRoom() {
  // If host status transferred to this player and host controls are missing, re-render
  if (clientState.isHost && !document.getElementById('start-game-btn') && currentNavigate) {
    renderWaitingRoom(currentNavigate);
    return;
  }

  const grid = document.getElementById('players-grid');
  if (grid) renderPlayerCards(grid);

  const label = document.getElementById('players-count-label');
  if (label) {
    label.textContent = `Players (${clientState.players.length}/${clientState.maxPlayers})`;
  }

  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) {
    startBtn.disabled = clientState.players.length < 2;
  }

  const addBotBtn = document.getElementById('add-bot-btn');
  if (addBotBtn) {
    addBotBtn.disabled = clientState.players.length >= clientState.maxPlayers;
  }
}

export default { renderWaitingRoom };
