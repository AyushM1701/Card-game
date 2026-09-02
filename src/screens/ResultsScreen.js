// src/screens/ResultsScreen.js — Round results & scores

import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import soundEngine from '../game/SoundEngine.js';
import { createCard } from '../components/Card.js';
import { formatCard } from '../game/CardUtils.js';

/**
 * Render the results screen.
 * @param {Function} navigate
 */
export function renderResultsScreen(navigate) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'results-screen';

  const data = clientState.roundResults;
  if (!data) {
    navigate('lobby');
    return;
  }

  const results = Array.isArray(data) ? data : (data.playerResults || []);
  const isMatchOver = data.isMatchOver !== undefined ? data.isMatchOver : true;
  const isMultiRound = clientState.totalRounds > 1;

  const roundWinner = results[0];
  const isWinnerMe = roundWinner && roundWinner.playerId === clientState.playerId;

  // Play sound
  if (isWinnerMe) {
    soundEngine.roundWin();
  } else {
    soundEngine.roundLose();
  }

  // Title
  const title = document.createElement('h1');
  title.className = 'results-title';
  if (isMultiRound && isMatchOver) {
    // Find overall match winner (lowest cumulative score)
    const sortedOverall = [...results].sort((a, b) => a.cumulativeScore - b.cumulativeScore);
    const matchWinner = sortedOverall[0];
    const isMatchWinnerMe = matchWinner.playerId === clientState.playerId;

    if (isMatchWinnerMe) {
      title.innerHTML = '<span class="shimmer-text">👑 MATCH CHAMPION! YOU WIN!</span>';
    } else {
      title.textContent = `👑 ${clientState.getPlayerName(matchWinner.playerId)} Wins the Match!`;
      title.style.color = 'var(--gold)';
    }
  } else if (isWinnerMe) {
    title.innerHTML = '<span class="shimmer-text">🏆 You Win The Round!</span>';
  } else {
    title.textContent = `🏆 ${clientState.getPlayerName(roundWinner.playerId)} Wins Round ${clientState.roundNumber}!`;
    title.style.color = 'var(--text-primary)';
  }
  screen.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'color:var(--text-muted);font-size:var(--fs-lg);margin-bottom:var(--space-lg);';
  subtitle.textContent = isMultiRound
    ? `Round ${clientState.roundNumber} of ${clientState.totalRounds} — Lowest score wins`
    : `Single Round — Lowest total wins`;
  screen.appendChild(subtitle);

  // Results table
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'glass-card';
  tableWrapper.style.width = '100%';
  tableWrapper.style.maxWidth = '750px';
  tableWrapper.style.padding = 'var(--space-lg)';
  tableWrapper.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.className = 'results-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Player</th>
      <th>Cards</th>
      <th>Round Total</th>
      ${isMultiRound ? '<th>Cumulative Score</th>' : ''}
    </tr>
  `;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');

  results.forEach((result, index) => {
    const tr = document.createElement('tr');
    if (result.isWinner) tr.className = 'winner';
    tr.style.animation = `fadeInUp 0.5s var(--ease-out) ${index * 150}ms both`;

    const rankTd = document.createElement('td');
    rankTd.textContent = result.isWinner ? '🥇' : `${index + 1}`;
    rankTd.style.fontSize = 'var(--fs-lg)';

    const nameTd = document.createElement('td');
    const playerName = clientState.getPlayerName(result.playerId);
    nameTd.textContent = playerName;
    if (result.playerId === clientState.playerId) {
      nameTd.textContent = `${playerName} `;
      const youBadge = document.createElement('span');
      youBadge.className = 'you-badge';
      youBadge.textContent = 'YOU';
      nameTd.appendChild(youBadge);
    }

    const cardsTd = document.createElement('td');
    const cardsRow = document.createElement('div');
    cardsRow.className = 'results-cards-row';

    result.cards.forEach((card, ci) => {
      const cardEl = createCard(card, {
        faceUp: true,
        dealing: true,
        dealIndex: ci + index * 3
      });
      cardEl.style.setProperty('--card-width', '45px');
      cardEl.style.setProperty('--card-height', '65px');
      cardsRow.appendChild(cardEl);
    });
    cardsTd.appendChild(cardsRow);

    const roundTotalTd = document.createElement('td');
    roundTotalTd.style.cssText = 'font-family:var(--font-heading);font-size:var(--fs-lg);font-weight:700;';
    roundTotalTd.textContent = `+${result.roundTotal || result.total}`;

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(cardsTd);
    tr.appendChild(roundTotalTd);

    if (isMultiRound) {
      const cumTd = document.createElement('td');
      cumTd.style.cssText = 'font-family:var(--font-heading);font-size:var(--fs-xl);font-weight:700;color:var(--gold);';
      cumTd.textContent = result.cumulativeScore;
      tr.appendChild(cumTd);
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  screen.appendChild(tableWrapper);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'results-actions';
  actions.style.marginTop = 'var(--space-xl)';

  // If multi-round and match is NOT over, host can start next round
  if (isMultiRound && !isMatchOver) {
    if (clientState.isHost) {
      const nextRoundBtn = document.createElement('button');
      nextRoundBtn.className = 'btn btn-primary btn-lg';
      nextRoundBtn.id = 'next-round-btn';
      nextRoundBtn.textContent = `🚀 Start Round ${clientState.roundNumber + 1}`;
      nextRoundBtn.addEventListener('click', () => {
        nextRoundBtn.disabled = true;
        nextRoundBtn.textContent = 'Dealing Next Round...';
        soundEngine.cardShuffle();
        socketClient.emit('start-next-round');
      });
      actions.appendChild(nextRoundBtn);
    } else {
      const waitNotice = document.createElement('div');
      waitNotice.style.cssText = 'color:var(--text-muted);font-size:var(--fs-sm);align-self:center;';
      waitNotice.textContent = 'Waiting for host to start next round...';
      actions.appendChild(waitNotice);
    }
  }

  // "Play Again" for the host when match is over (or single round ended)
  if (isMatchOver || !isMultiRound) {
    if (clientState.isHost) {
      const playAgainBtn = document.createElement('button');
      playAgainBtn.className = 'btn btn-primary btn-lg';
      playAgainBtn.id = 'play-again-btn';
      playAgainBtn.textContent = '🔄 Play Again';
      playAgainBtn.addEventListener('click', () => {
        playAgainBtn.disabled = true;
        playAgainBtn.textContent = 'Creating Room...';
        soundEngine.cardShuffle();

        const savedName = clientState.playerName || localStorage.getItem('undercut_name') || 'Player';
        const savedMaxPlayers = clientState.maxPlayers || 4;
        const savedTotalRounds = clientState.totalRounds || 1;

        clientState.clearSession();
        clientState.reset();

        const createNew = () => {
          socketClient.emit('create-room', {
            playerName: savedName,
            maxPlayers: savedMaxPlayers,
            totalRounds: savedTotalRounds
          }, (res) => {
            if (res && res.success) {
              clientState.setRoom(res.roomCode, res.playerId, res.players, true, false, res.totalRounds);
              navigate('waiting');
            } else {
              navigate('lobby');
            }
          });
        };

        if (socketClient.connected) {
          createNew();
        } else {
          socketClient.connect();
          const onConnect = () => {
            socketClient.off('_connected', onConnect);
            createNew();
          };
          socketClient.on('_connected', onConnect);
          setTimeout(() => {
            if (!clientState.roomCode) navigate('lobby');
          }, 4000);
        }
      });
      actions.appendChild(playAgainBtn);
    }
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary btn-lg';
  backBtn.textContent = '🏠 Back to Lobby';
  backBtn.addEventListener('click', () => {
    soundEngine.click();
    clientState.clearSession();
    clientState.reset();
    navigate('lobby');
  });
  actions.appendChild(backBtn);

  screen.appendChild(actions);
  app.appendChild(screen);
}

export default { renderResultsScreen };
