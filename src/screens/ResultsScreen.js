// src/screens/ResultsScreen.js — Round results & scores

import clientState from '../game/ClientState.js';
import socketClient from '../game/SocketClient.js';
import soundEngine from '../game/SoundEngine.js';
import { createCard } from '../components/Card.js';
import { formatCard } from '../game/CardUtils.js';
import { cleanupListeners } from './GameScreen.js';

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

  const isMatchOver = data.isMatchOver !== undefined ? data.isMatchOver : true;
  const isMultiRound = clientState.totalRounds > 1;

  const rawResults = Array.isArray(data) ? data : (data.playerResults || []);
  const results = [...rawResults].sort((a, b) => {
    if (isMatchOver && isMultiRound) {
      return (a.cumulativeScore ?? 0) - (b.cumulativeScore ?? 0);
    }
    return (a.roundTotal ?? a.total ?? 0) - (b.roundTotal ?? b.total ?? 0);
  });

  const minRoundTotal = rawResults.length > 0
    ? Math.min(...rawResults.map(r => r.roundTotal ?? r.total ?? 0))
    : 0;
  const roundWinners = rawResults.filter(r => (r.roundTotal ?? r.total ?? 0) === minRoundTotal);
  const isWinnerMe = roundWinners.some(w => w.playerId === clientState.playerId);

  // Find overall match winner (lowest cumulative score)
  const minCumScore = results.length > 0 ? Math.min(...results.map(r => r.cumulativeScore ?? 0)) : 0;
  const matchWinners = results.filter(w => (w.cumulativeScore ?? 0) === minCumScore);
  const isMatchWinnerMe = matchWinners.some(w => w.playerId === clientState.playerId);

  // Play sound
  if ((isMultiRound && isMatchOver) ? isMatchWinnerMe : isWinnerMe) {
    soundEngine.roundWin();
  } else {
    soundEngine.roundLose();
  }

  // Title
  const title = document.createElement('h1');
  title.className = 'results-title';
  if (isMultiRound && isMatchOver) {
    if (isMatchWinnerMe) {
      title.innerHTML = matchWinners.length > 1
        ? '<span class="shimmer-text">👑 TIED MATCH CHAMPIONS! YOU WIN!</span>'
        : '<span class="shimmer-text">👑 MATCH CHAMPION! YOU WIN!</span>';
    } else {
      const winnerNames = matchWinners.map(w => clientState.getPlayerName(w.playerId)).join(' & ');
      title.textContent = `👑 ${winnerNames} Wins the Match!`;
      title.style.color = 'var(--gold)';
    }
  } else if (isWinnerMe) {
    title.innerHTML = roundWinners.length > 1
      ? '<span class="shimmer-text">🏆 You Tied for the Round Win!</span>'
      : '<span class="shimmer-text">🏆 You Win The Round!</span>';
  } else {
    const winnerNames = roundWinners.map(w => clientState.getPlayerName(w.playerId)).join(' & ');
    title.textContent = `🏆 ${winnerNames} Wins Round ${clientState.roundNumber}!`;
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
    const isChampion = isMatchOver && isMultiRound && (result.cumulativeScore ?? 0) === minCumScore;
    const isRoundWinner = (!isMatchOver || !isMultiRound) && (result.isWinner || (result.roundTotal ?? result.total ?? 0) === minRoundTotal);
    const isWinner = isChampion || isRoundWinner;
    if (isWinner) tr.className = 'winner';
    tr.style.animation = `fadeInUp 0.5s var(--ease-out) ${index * 150}ms both`;

    const rankTd = document.createElement('td');
    if (isChampion) {
      rankTd.textContent = '👑';
      rankTd.title = 'Champion';
    } else if (isRoundWinner) {
      rankTd.textContent = '🥇';
      rankTd.title = 'Round Winner';
    } else {
      rankTd.textContent = `${index + 1}`;
    }
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
    if (isChampion) {
      const champBadge = document.createElement('span');
      champBadge.className = 'you-badge';
      champBadge.style.cssText = 'background: hsla(43, 85%, 55%, 0.2); color: var(--gold); border-color: var(--gold); margin-left: 6px;';
      champBadge.textContent = '👑 Champion';
      nameTd.appendChild(champBadge);
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
        playAgainBtn.textContent = 'Requesting Rematch...';
        soundEngine.cardShuffle();
        socketClient.emit('request-rematch', null, (res) => {
          if (!res?.success) {
            playAgainBtn.disabled = false;
            playAgainBtn.textContent = '🔄 Play Again';
          }
        });
      });
      actions.appendChild(playAgainBtn);
    } else {
      const waitNotice = document.createElement('div');
      waitNotice.style.cssText = 'color:var(--text-muted);font-size:var(--fs-sm);align-self:center;';
      waitNotice.textContent = 'Waiting for host to start rematch...';
      actions.appendChild(waitNotice);
    }
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary btn-lg';
  backBtn.textContent = '🏠 Back to Lobby';
  backBtn.addEventListener('click', () => {
    soundEngine.click();
    cleanupListeners();
    socketClient.emit('leave-room', null, () => {});
    clientState.clearSession();
    clientState.reset();
    navigate('lobby');
  });
  actions.appendChild(backBtn);

  screen.appendChild(actions);
  app.appendChild(screen);
}

export default { renderResultsScreen };
