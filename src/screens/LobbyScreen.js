// src/screens/LobbyScreen.js — Create/Join game screen

import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import { showToast } from '../components/Toast.js';

/**
 * Render the lobby screen.
 * @param {Function} navigate - (screen) => void
 */
export function renderLobbyScreen(navigate) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'lobby-screen';

  // Background particles (floating card suits)
  const particles = document.createElement('div');
  particles.className = 'lobby-bg-particles';
  const suits = ['♠', '♥', '♦', '♣', '🂠', '🃏'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = suits[i % suits.length];
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.fontSize = `${1.5 + Math.random() * 2}rem`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    p.style.setProperty('--dy', `${-100 - Math.random() * 300}px`);
    p.style.setProperty('--dr', `${Math.random() * 360}deg`);
    p.style.animationDelay = `${Math.random() * 15}s`;
    p.style.animationDuration = `${12 + Math.random() * 8}s`;
    particles.appendChild(p);
  }
  screen.appendChild(particles);

  // Title
  const title = document.createElement('h1');
  title.className = 'lobby-title shimmer-text';
  title.textContent = 'MIND F*CK';
  screen.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'lobby-subtitle';
  subtitle.textContent = 'The strategic memory card game';
  screen.appendChild(subtitle);

  const htpLink = document.createElement('button');
  htpLink.className = 'btn btn-ghost btn-sm';
  htpLink.id = 'how-to-play-btn';
  htpLink.style.cssText = 'margin-top: var(--space-sm); font-size: var(--fs-sm); color: var(--text-muted); border: 1px solid var(--glass-border); letter-spacing: 0.02em;';
  htpLink.textContent = '📖 How to Play';
  htpLink.addEventListener('click', () => navigate('how-to-play'));
  screen.appendChild(htpLink);

  // Form container
  const form = document.createElement('div');
  form.className = 'lobby-form glass-card anim-fade-in-up';

  // Name input
  const nameLabel = document.createElement('label');
  nameLabel.className = 'label';
  nameLabel.textContent = 'Your Name';
  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.id = 'player-name-input';
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter your display name';
  nameInput.maxLength = 20;
  nameInput.value = localStorage.getItem('undercut_name') || '';
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('create-game-btn')?.click();
    }
  });
  form.appendChild(nameLabel);
  form.appendChild(nameInput);

  // Player count (for creating)
  const countSection = document.createElement('div');
  countSection.id = 'player-count-section';

  const countLabel = document.createElement('label');
  countLabel.className = 'label';
  countLabel.textContent = 'Max Players';

  const countSelector = document.createElement('div');
  countSelector.className = 'player-count-selector';

  let maxPlayers = 4;
  const minusBtn = document.createElement('button');
  minusBtn.className = 'count-btn';
  minusBtn.textContent = '−';

  const countDisplay = document.createElement('div');
  countDisplay.className = 'count-display';
  countDisplay.textContent = maxPlayers;

  const plusBtn = document.createElement('button');
  plusBtn.className = 'count-btn';
  plusBtn.textContent = '+';

  const deckNote = document.createElement('div');
  deckNote.style.cssText = 'font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:4px;';
  deckNote.id = 'deck-note';
  deckNote.textContent = '1 deck';

  minusBtn.addEventListener('click', () => {
    if (maxPlayers > 2) {
      maxPlayers--;
      countDisplay.textContent = maxPlayers;
      deckNote.textContent = maxPlayers >= 5 ? '2 decks' : '1 deck';
    }
  });

  plusBtn.addEventListener('click', () => {
    if (maxPlayers < 10) {
      maxPlayers++;
      countDisplay.textContent = maxPlayers;
      deckNote.textContent = maxPlayers >= 5 ? '2 decks' : '1 deck';
    }
  });

  countSelector.appendChild(minusBtn);
  countSelector.appendChild(countDisplay);
  countSelector.appendChild(plusBtn);

  countSection.appendChild(countLabel);
  countSection.appendChild(countSelector);
  countSection.appendChild(deckNote);
  form.appendChild(countSection);

  // Rounds selector (for multi-round match)
  const roundSection = document.createElement('div');
  roundSection.id = 'round-count-section';
  roundSection.style.marginTop = 'var(--space-sm)';

  const roundLabel = document.createElement('label');
  roundLabel.className = 'label';
  roundLabel.textContent = 'Match Rounds';

  const roundSelector = document.createElement('div');
  roundSelector.className = 'player-count-selector';

  let totalRounds = 1;
  const roundMinusBtn = document.createElement('button');
  roundMinusBtn.className = 'count-btn';
  roundMinusBtn.textContent = '−';

  const roundDisplay = document.createElement('div');
  roundDisplay.className = 'count-display';
  roundDisplay.textContent = totalRounds;

  const roundPlusBtn = document.createElement('button');
  roundPlusBtn.className = 'count-btn';
  roundPlusBtn.textContent = '+';

  const roundNote = document.createElement('div');
  roundNote.style.cssText = 'font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:4px;';
  roundNote.id = 'round-note';
  roundNote.textContent = 'Single round match';

  roundMinusBtn.addEventListener('click', () => {
    if (totalRounds > 1) {
      totalRounds--;
      roundDisplay.textContent = totalRounds;
      roundNote.textContent = totalRounds === 1 ? 'Single round match' : `${totalRounds} rounds cumulative score`;
    }
  });

  roundPlusBtn.addEventListener('click', () => {
    if (totalRounds < 10) {
      totalRounds++;
      roundDisplay.textContent = totalRounds;
      roundNote.textContent = `${totalRounds} rounds cumulative score`;
    }
  });

  roundSelector.appendChild(roundMinusBtn);
  roundSelector.appendChild(roundDisplay);
  roundSelector.appendChild(roundPlusBtn);

  roundSection.appendChild(roundLabel);
  roundSection.appendChild(roundSelector);
  roundSection.appendChild(roundNote);
  form.appendChild(roundSection);

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'lobby-actions';

  const createBtn = document.createElement('button');
  createBtn.className = 'btn btn-primary btn-lg';
  createBtn.id = 'create-game-btn';
  createBtn.textContent = '🎲 Create Game';

  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Please enter your name', { type: 'warning' });
      nameInput.focus();
      return;
    }

    clientState.clearSession();
    clientState.reset();
    localStorage.setItem('undercut_name', name);
    clientState.playerName = name;
    clientState.maxPlayers = maxPlayers;
    clientState.totalRounds = totalRounds;

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    socketClient.emit('create-room', { playerName: name, maxPlayers, totalRounds }, (res) => {
      createBtn.disabled = false;
      createBtn.textContent = '🎲 Create Game';

      if (res.success) {
        clientState.setRoom(res.roomCode, res.playerId, res.players, true, false, res.totalRounds || totalRounds, res.reconnectToken, res.maxPlayers);
        navigate('waiting');
      } else {
        showToast(res.error || 'Failed to create game', { type: 'error' });
      }
    });
  });

  actions.appendChild(createBtn);
  form.appendChild(actions);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'lobby-divider';
  divider.textContent = 'or join a game';
  form.appendChild(divider);

  // Join section with 1-tap Paste button
  const joinLabel = document.createElement('label');
  joinLabel.className = 'label';
  joinLabel.textContent = 'Room Code';

  const codeInputWrapper = document.createElement('div');
  codeInputWrapper.style.cssText = 'display:flex;gap:var(--space-sm);align-items:center;width:100%;';

  const codeInput = document.createElement('input');
  codeInput.className = 'input';
  codeInput.id = 'room-code-input';
  codeInput.type = 'text';
  codeInput.placeholder = '6-CHAR CODE';
  codeInput.maxLength = 6;
  codeInput.style.textTransform = 'uppercase';
  codeInput.style.letterSpacing = '0.2em';
  codeInput.style.textAlign = 'center';
  codeInput.style.fontFamily = 'var(--font-heading)';
  codeInput.style.fontWeight = '700';
  codeInput.style.fontSize = 'var(--fs-xl)';
  codeInput.style.flex = '1';

  // Auto-uppercase on type or paste
  codeInput.addEventListener('input', (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 6) val = val.substring(0, 6);
    codeInput.value = val;
  });

  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('join-game-btn')?.click();
    }
  });

  // 1-Tap Paste Button (especially handy for mobile/touch)
  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'btn btn-secondary';
  pasteBtn.id = 'paste-code-btn';
  pasteBtn.style.padding = '10px 14px';
  pasteBtn.style.fontSize = 'var(--fs-sm)';
  pasteBtn.style.whiteSpace = 'nowrap';
  pasteBtn.textContent = '📋 Paste';
  pasteBtn.title = 'Paste room code from clipboard';
  pasteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      let text = await navigator.clipboard.readText();
      text = text.trim();
      // If full URL was copied, extract code param
      if (text.includes('code=')) {
        const match = text.match(/code=([A-Za-z0-9]{6})/i);
        if (match) text = match[1];
      }
      text = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (text.length > 6) text = text.substring(0, 6);
      if (text) {
        codeInput.value = text;
        showToast(`Pasted code: ${text}`, { type: 'success', icon: '📋' });
      } else {
        showToast('Clipboard is empty', { type: 'warning' });
      }
    } catch {
      // Fallback for permissions
      codeInput.focus();
      showToast('Tap the box and paste your code', { type: 'info' });
    }
  });

  codeInputWrapper.appendChild(codeInput);
  codeInputWrapper.appendChild(pasteBtn);

  form.appendChild(joinLabel);
  form.appendChild(codeInputWrapper);

  const joinBtn = document.createElement('button');
  joinBtn.className = 'btn btn-secondary btn-lg';
  joinBtn.id = 'join-game-btn';
  joinBtn.textContent = '🚪 Join Game';
  joinBtn.style.width = '100%';
  joinBtn.style.marginTop = 'var(--space-md)';

  joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();

    if (!name) {
      showToast('Please enter your name', { type: 'warning' });
      nameInput.focus();
      return;
    }
    if (!code || code.length < 6) {
      showToast('Please enter a valid room code', { type: 'warning' });
      codeInput.focus();
      return;
    }

    localStorage.setItem('undercut_name', name);
    clientState.playerName = name;

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';

    const savedId = localStorage.getItem('undercut_player_id');
    const savedToken = localStorage.getItem('undercut_reconnect_token');
    socketClient.emit('join-room', { roomCode: code, playerName: name, playerId: savedId, reconnectToken: savedToken }, (res) => {
      joinBtn.disabled = false;
      joinBtn.textContent = '🚪 Join Game';

      if (res.success) {
        if (res.gameView) {
          clientState.resumeGame(res.roomCode, res.playerId, res.players, res.isHost, res.isSpectator, res.totalRounds, res.gameView, res.reconnectToken || savedToken, res.maxPlayers);
        } else {
          clientState.setRoom(res.roomCode, res.playerId, res.players, res.isHost || false, res.isSpectator, res.totalRounds, res.reconnectToken || savedToken, res.maxPlayers);
        }
        if (res.isSpectator) {
          showToast(`Joined as spectator (${res.spectatorCount || 1} watching)`, { type: 'info', icon: '👁️' });
          navigate('game');
        } else if (res.status === 'playing') {
          navigate('game');
        } else {
          navigate('waiting');
        }
      } else {
        showToast(res.error || 'Failed to join game', { type: 'error' });
      }
    });
  });

  form.appendChild(joinBtn);
  screen.appendChild(form);

  // Check URL for room code
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = urlParams.get('code');
  if (urlCode) {
    codeInput.value = urlCode.toUpperCase();
  }

  app.appendChild(screen);
  nameInput.focus();
}

export default { renderLobbyScreen };
