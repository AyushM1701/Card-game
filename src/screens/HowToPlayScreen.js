// src/screens/HowToPlayScreen.js — Animated, engaging rules guide

/**
 * Render the How to Play screen.
 * @param {Function} navigate - (screen) => void
 */
export function renderHowToPlayScreen(navigate) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'htp-screen';

  // ── Floating background particles ──────────────────────
  const particles = document.createElement('div');
  particles.className = 'lobby-bg-particles';
  const suits = ['♠', '♥', '♦', '♣'];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = suits[i % 4];
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.fontSize = `${1 + Math.random() * 1.5}rem`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 150}px`);
    p.style.setProperty('--dy', `${-80 - Math.random() * 200}px`);
    p.style.setProperty('--dr', `${Math.random() * 360}deg`);
    p.style.animationDelay = `${Math.random() * 12}s`;
    p.style.animationDuration = `${14 + Math.random() * 8}s`;
    p.style.opacity = '0.12';
    particles.appendChild(p);
  }
  screen.appendChild(particles);

  // ── Sticky back button ──────────────────────────────────
  const backBar = document.createElement('div');
  backBar.className = 'htp-back-bar';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost btn-sm htp-back-btn';
  backBtn.id = 'htp-back-btn';
  backBtn.textContent = '← Back to Lobby';
  backBtn.addEventListener('click', () => navigate('lobby'));
  backBar.appendChild(backBtn);
  screen.appendChild(backBar);

  // ── Content wrapper ─────────────────────────────────────
  const content = document.createElement('div');
  content.className = 'htp-content';

  // ── Hero ────────────────────────────────────────────────
  const hero = document.createElement('div');
  hero.className = 'htp-hero anim-fade-in-up';

  const heroTitle = document.createElement('h1');
  heroTitle.className = 'htp-hero-title shimmer-text';
  heroTitle.textContent = 'How to Play';

  const heroSub = document.createElement('p');
  heroSub.className = 'htp-hero-sub';
  heroSub.innerHTML = 'Learn <strong>MIND F*CK</strong> in 2 minutes — the strategic memory card game where the lowest hand wins.';

  hero.appendChild(heroTitle);
  hero.appendChild(heroSub);
  content.appendChild(hero);

  // ── Sections ────────────────────────────────────────────
  const sections = buildSections();
  sections.forEach(s => content.appendChild(s));

  // ── Play button at bottom ───────────────────────────────
  const cta = document.createElement('div');
  cta.className = 'htp-cta';
  const playBtn = document.createElement('button');
  playBtn.className = 'btn btn-primary btn-lg';
  playBtn.id = 'htp-play-btn';
  playBtn.textContent = "🎲 I'm Ready — Let's Play!";
  playBtn.addEventListener('click', () => navigate('lobby'));
  cta.appendChild(playBtn);
  content.appendChild(cta);

  screen.appendChild(content);
  app.appendChild(screen);

  // Animate sections into view on scroll
  initScrollAnimations();
}

// ─── Section builders ──────────────────────────────────────

function buildSections() {
  return [
    buildObjectiveSection(),
    buildSetupSection(),
    buildTurnSection(),
    buildActionCardsSection(),
    buildCardValuesSection(),
    buildEndSection(),
    buildTipsSection(),
  ];
}

function makeSection(id, icon, title, colorVar) {
  const sec = document.createElement('section');
  sec.className = 'htp-section htp-reveal';
  sec.id = id;

  const header = document.createElement('div');
  header.className = 'htp-section-header';
  header.style.setProperty('--accent', colorVar);

  const iconEl = document.createElement('div');
  iconEl.className = 'htp-section-icon';
  iconEl.textContent = icon;
  iconEl.style.background = `hsla(${colorVar}, 0.12)`;
  iconEl.style.border = `1px solid hsla(${colorVar}, 0.3)`;

  const titleEl = document.createElement('h2');
  titleEl.className = 'htp-section-title';
  titleEl.textContent = title;

  header.appendChild(iconEl);
  header.appendChild(titleEl);
  sec.appendChild(header);

  return sec;
}

function makeCard(content) {
  const card = document.createElement('div');
  card.className = 'htp-card glass-card';
  card.innerHTML = content;
  return card;
}

function makeStepList(steps) {
  const ol = document.createElement('ol');
  ol.className = 'htp-steps';
  steps.forEach(step => {
    const li = document.createElement('li');
    li.className = 'htp-step';
    li.innerHTML = step;
    ol.appendChild(li);
  });
  return ol;
}

function buildObjectiveSection() {
  const sec = makeSection('htp-objective', '🏆', 'The Goal', '43, 85%, 55%');

  const card = makeCard(`
    <p class="htp-lead">Each player holds <strong>3 cards face-down</strong>. At the end of the round, everyone reveals them.</p>
    <div class="htp-highlight-box">
      <span class="htp-highlight-icon">🥇</span>
      <div>
        <strong>Lowest total wins the round.</strong>
        <span class="htp-muted"> That's it. The catch? You can only look at your cards <em>once</em> at the very start — then you're playing from memory.</span>
      </div>
    </div>
  `);
  sec.appendChild(card);
  return sec;
}

function buildSetupSection() {
  const sec = makeSection('htp-setup', '🃏', 'Setup', '210, 80%, 58%');

  sec.appendChild(makeStepList([
    '3 cards are dealt <strong>face-down</strong> to each player.',
    'You get <strong>8 seconds</strong> to peek at your 3 cards and memorize them.',
    'The cards go face-down and <strong>stay face-down</strong>. No peeking again — unless you play a King.',
    'The remaining deck becomes the <strong>Draw Pile</strong>.',
    'Turns rotate clockwise. The round ends when the Draw Pile runs dry.',
  ]));

  const tip = document.createElement('div');
  tip.className = 'htp-callout htp-callout--warning';
  tip.innerHTML = `<span>⚡</span> <span><strong>Memory is everything.</strong> If you forget which slot holds which card, you're flying blind. That's the game.</span>`;
  sec.appendChild(tip);

  return sec;
}

function buildTurnSection() {
  const sec = makeSection('htp-turn', '🔄', 'Your Turn', '145, 65%, 42%');

  const intro = document.createElement('p');
  intro.className = 'htp-body';
  intro.innerHTML = 'On your turn, draw the top card from the Draw Pile. You have two choices based on what you drew:';
  sec.appendChild(intro);

  const grid = document.createElement('div');
  grid.className = 'htp-turn-grid';

  // Plain card choice
  const plain = document.createElement('div');
  plain.className = 'htp-turn-card glass-card';
  plain.innerHTML = `
    <div class="htp-turn-card-header" style="color: hsl(145, 65%, 55%)">
      <span>🂡</span> Drew a Plain Card
    </div>
    <p>Compare it to your <em>memory</em> of your 3 slots.</p>
    <ul class="htp-list">
      <li><strong>Swap it</strong> into any slot — even a risky one. The card you replace gets discarded.</li>
      <li><strong>Discard it</strong> and keep your hand exactly as it is.</li>
    </ul>
    <div class="htp-turn-warning">⚠️ You're swapping blind — you might upgrade or accidentally wreck a good slot!</div>
  `;

  // Action card choice
  const action = document.createElement('div');
  action.className = 'htp-turn-card glass-card';
  action.innerHTML = `
    <div class="htp-turn-card-header" style="color: hsl(43, 85%, 65%)">
      <span>⚡</span> Drew an Action Card
    </div>
    <p>Action cards (7, J, Q, K) give you a superpower. Choose:</p>
    <ul class="htp-list">
      <li><strong>Play it now</strong> — use the power immediately, then discard it.</li>
      <li><strong>Bank it</strong> — swap it into any slot to save its power for later. This can remove a high card from your hand!</li>
    </ul>
    <div class="htp-turn-note">💡 Banked action cards can be triggered later when another card replaces them.</div>
  `;

  grid.appendChild(plain);
  grid.appendChild(action);
  sec.appendChild(grid);

  return sec;
}

function buildActionCardsSection() {
  const sec = makeSection('htp-actions', '⚡', 'Action Cards', '38, 92%, 55%');

  const intro = document.createElement('p');
  intro.className = 'htp-body';
  intro.innerHTML = 'Four special cards change everything. Play them for an instant effect or bank them to hold their power.';
  sec.appendChild(intro);

  const actions = [
    {
      rank: 'K', name: 'King — Peek Own', color: 'hsl(43, 85%, 55%)',
      desc: 'Secretly look at all 3 of your own cards. The <strong>only</strong> way to re-check your hand during the game.',
      badge: '\u265a', tip: 'Use it when you\'ve genuinely forgotten what\'s in a slot. Muscle memory wins.',
    },
    {
      rank: 'Q', name: 'Queen — Peek Opponent', color: 'hsl(280, 70%, 65%)',
      desc: 'Secretly look at all 3 cards of any opponent. You know their hand \u2014 they don\'t know you know.',
      badge: '♛', tip: 'Best played when you\'re close to winning and need to compare.',
    },
    {
      rank: 'J', name: 'Jack — Blind Trade', color: 'hsl(210, 80%, 58%)',
      desc: 'Swap one of your card slots with one of an opponent\'s. <em>Neither player looks at either card.</em> Pure chaos.',
      badge: '♝', tip: 'Target the opponent who seems most confident \u2014 they probably have a low card. Trade your worst slot.',
    },
    {
      rank: '7', name: 'Seven — Scramble', color: 'hsl(0, 72%, 52%)',
      desc: 'Randomly rearrange all 3 of an opponent\'s card positions without looking. Everything they memorized becomes useless.',
      badge: '7', tip: 'Devastating on a player who just used a King. They memorized... and now it\'s all wrong.',
    },
  ];

  const grid = document.createElement('div');
  grid.className = 'htp-action-grid';

  actions.forEach(a => {
    const card = document.createElement('div');
    card.className = 'htp-action-card glass-card';
    card.innerHTML = `
      <div class="htp-action-rank" style="color: ${a.color}; border-color: ${a.color}40;">${a.badge}</div>
      <div class="htp-action-name" style="color: ${a.color}">${a.name}</div>
      <p class="htp-action-desc">${a.desc}</p>
      <div class="htp-action-tip">💡 ${a.tip}</div>
    `;
    grid.appendChild(card);
  });

  sec.appendChild(grid);
  return sec;
}

function buildCardValuesSection() {
  const sec = makeSection('htp-values', '🎴', 'Card Values', '145, 50%, 35%');

  const intro = document.createElement('p');
  intro.className = 'htp-body';
  intro.innerHTML = 'At round end, everyone reveals their hand. Cards count at face value:';
  sec.appendChild(intro);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'htp-table-wrap';

  const table = document.createElement('table');
  table.className = 'htp-table';
  table.innerHTML = `
    <thead>
      <tr><th>Card</th><th>Value</th><th>Type</th></tr>
    </thead>
    <tbody>
      <tr><td>Ace</td><td class="htp-val">1</td><td class="htp-type">Plain</td></tr>
      <tr><td>2 – 6</td><td class="htp-val">2 – 6</td><td class="htp-type">Plain</td></tr>
      <tr class="htp-action-row"><td>7</td><td class="htp-val">7</td><td class="htp-type htp-badge-action">⚡ Scramble</td></tr>
      <tr><td>8, 9, 10</td><td class="htp-val">8 – 10</td><td class="htp-type">Plain</td></tr>
      <tr class="htp-action-row"><td>Jack</td><td class="htp-val">11</td><td class="htp-type htp-badge-action">⚡ Blind Trade</td></tr>
      <tr class="htp-action-row"><td>Queen</td><td class="htp-val">12</td><td class="htp-type htp-badge-action">⚡ Peek Opponent</td></tr>
      <tr class="htp-action-row"><td>King</td><td class="htp-val">13</td><td class="htp-type htp-badge-action">⚡ Peek Own</td></tr>
    </tbody>
  `;
  tableWrap.appendChild(table);
  sec.appendChild(tableWrap);

  const callout = document.createElement('div');
  callout.className = 'htp-callout htp-callout--info';
  callout.innerHTML = `<span>🧠</span> <span>An unplayed Action card is still worth its full face value at round end. A banked King = 13 points in your hand if never triggered. Use it or lose (points) with it.</span>`;
  sec.appendChild(callout);

  return sec;
}

function buildEndSection() {
  const sec = makeSection('htp-end', '🏁', 'Ending the Round', '0, 72%, 52%');

  const card = makeCard(`
    <div class="htp-end-grid">
      <div class="htp-end-item">
        <div class="htp-end-icon">🃏</div>
        <strong>Draw Pile Empty</strong>
        <p>The round ends immediately when no cards remain to draw.</p>
      </div>
      <div class="htp-end-item">
        <div class="htp-end-icon">👁️</div>
        <strong>Reveal All</strong>
        <p>Everyone flips their 3 cards face-up. No hiding now.</p>
      </div>
      <div class="htp-end-item">
        <div class="htp-end-icon">➕</div>
        <strong>Add Up</strong>
        <p>Sum your 3 card values. Aces count as 1.</p>
      </div>
      <div class="htp-end-item" style="border-color: hsl(43,85%,55%,0.3); background: hsla(43,85%,55%,0.06)">
        <div class="htp-end-icon">🥇</div>
        <strong style="color: hsl(43,85%,65%)">Lowest Wins!</strong>
        <p>The player with the smallest total takes the round.</p>
      </div>
    </div>
  `);
  sec.appendChild(card);
  return sec;
}

function buildTipsSection() {
  const sec = makeSection('htp-tips', '🧠', 'Pro Tips', '280, 70%, 65%');

  const tips = [
    { icon: '🎯', text: '<strong>Prioritize your slots mentally.</strong> Think of them as Left / Middle / Right. Repeat their values in your head after each swap.' },
    { icon: '🔄', text: '<strong>The Blind Trade is a weapon.</strong> Target the player who just peeked their own hand — they know exactly what they have, so scramble their confidence.' },
    { icon: '💀', text: '<strong>Discard is always safe.</strong> If you drew high and don\'t want to risk your hand, just discard it. No shame in passing.' },
    { icon: '👑', text: '<strong>Bank the King, not play it.</strong> A banked King removes a potentially high card from your hand AND saves the peek power for when you forget.' },
    { icon: '🎲', text: '<strong>Late game = chaos.</strong> When the draw pile is almost gone, aggressive swaps and trades can flip the outcome entirely.' },
  ];

  const list = document.createElement('div');
  list.className = 'htp-tips-list';

  tips.forEach((tip, i) => {
    const item = document.createElement('div');
    item.className = 'htp-tip-item glass-card htp-reveal';
    item.style.animationDelay = `${i * 0.08}s`;
    item.innerHTML = `<span class="htp-tip-icon">${tip.icon}</span><span>${tip.text}</span>`;
    list.appendChild(item);
  });

  sec.appendChild(list);
  return sec;
}

// ── Scroll-reveal animations ────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('htp-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.htp-reveal').forEach(el => observer.observe(el));
}

export default { renderHowToPlayScreen };
