import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fileOrder = [
  'package.json',
  'vite.config.js',
  '.gitignore',
  '.env.example',
  'index.html',
  'public/favicon.svg',
  'server/index.js',
  'server/GameManager.js',
  'server/RoomManager.js',
  'server/socketHandlers.js',
  'server/Deck.js',
  'server/BotEngine.js',
  'src/main.js',
  'src/game/ClientState.js',
  'src/game/SocketClient.js',
  'src/game/SoundEngine.js',
  'src/game/CardUtils.js',
  'src/game/CardAnimationEngine.js',
  'src/screens/LobbyScreen.js',
  'src/screens/WaitingRoom.js',
  'src/screens/GameScreen.js',
  'src/screens/ResultsScreen.js',
  'src/components/Table.js',
  'src/components/Seat.js',
  'src/components/Card.js',
  'src/components/DrawPile.js',
  'src/components/DiscardPile.js',
  'src/components/DrawnCardPanel.js',
  'src/components/ActionModal.js',
  'src/components/Toast.js',
  'src/styles/index.css',
  'src/styles/table.css',
  'src/styles/cards.css',
  'src/styles/animations.css',
  'scripts/build_source_doc.js'
];

let doc = `# MIND F*CK — Architecture & Complete Source Code

This document provides a comprehensive technical breakdown of the system architecture, design patterns, state machines, networking protocols, animation/sound engines, followed by the complete and exact source code of every file in the project.

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Game State Machine & Lifecycle](#3-game-state-machine--lifecycle)
4. [WebSocket Networking Protocol](#4-websocket-networking-protocol)
5. [Action Card Mechanics & Resolution](#5-action-card-mechanics--resolution)
6. [Trigonometric Table Layout & User-Centric Perspective](#6-trigonometric-table-layout--user-centric-perspective)
7. [Procedural Audio Engine](#7-procedural-audio-engine)
8. [3D Flight & Action Animation Engine](#8-3d-flight--action-animation-engine)
9. [AI Bot Strategy Engine](#9-ai-bot-strategy-engine)
10. [Complete Source Code Listing](#10-complete-source-code-listing)

---

## 1. System Architecture Overview

**MIND F*CK** (formerly Undercut) is a real-time multiplayer strategic memory card game designed for 2 to 10 players with full mobile responsiveness, AI bot fill, multi-round scoring, procedural Web Audio effects, and 3D card animation flight physics.

### Tech Stack
- **Client**: Pure Vanilla ES6+ JavaScript, Modular Component Architecture, Vite Dev Server & Bundler.
- **Server**: Node.js + Express + Socket.IO WebSocket Engine.
- **Styling**: Vanilla CSS3 Custom Properties (Design Tokens), Glassmorphism, CSS 3D Transforms (\`perspective\`, \`rotateY\`, \`transform-style: preserve-3d\`), Spring Transitions.
- **Audio**: Web Audio API Procedural Synthesizer (0 external audio asset dependencies).
- **Network**: Socket.IO Bidirectional Event Streams with room-based multiplexing and spectator broadcasting.

\`\`\`mermaid
graph TD
  subgraph Client_Layer [Frontend Client - Vanilla JS + Vite]
    A[main.js Router] --> B[LobbyScreen]
    A --> C[WaitingRoom]
    A --> D[GameScreen]
    A --> E[ResultsScreen]
    D --> F[Table & Seats]
    D --> G[CardAnimationEngine]
    D --> H[SoundEngine - Web Audio]
    D --> I[ActionModal]
    D --> J[DrawnCardPanel]
    K[ClientState] <--> L[SocketClient]
  end

  subgraph Server_Layer [Backend Server - Node.js + Socket.IO]
    M[server/index.js] --> N[socketHandlers.js]
    N <--> O[RoomManager]
    N <--> P[GameManager]
    N <--> Q[BotEngine]
    P --> R[Deck & Rules Engine]
  end

  L <==> |WebSocket Events| N
\`\`\`

---

## 2. Directory Structure

\`\`\`
card-game/
├── index.html                   # HTML5 Entry point & CSS imports
├── package.json                 # Dependencies & scripts (express, socket.io, vite)
├── vite.config.js               # Vite config with LAN host binding & proxy
├── server/                      # Node.js + Socket.IO backend
│   ├── index.js                 # Server entry point & Express setup
│   ├── GameManager.js           # Authoritative rules & game state machine
│   ├── RoomManager.js           # Room code generation, lobby & spectator management
│   ├── socketHandlers.js        # Socket.IO event controllers & broadcasts
│   ├── Deck.js                  # 52-card deck generator, shuffling & card value rules
│   └── BotEngine.js             # AI bot heuristics, decision tree & simulated latency
├── src/                         # Frontend client application
│   ├── main.js                  # Client entry point & SPA screen router
│   ├── game/                    # Client game engine modules
│   │   ├── ClientState.js       # Reactive client-side game state store
│   │   ├── SocketClient.js      # Socket.IO connection manager & wrapper
│   │   ├── SoundEngine.js       # Procedural Web Audio API sound synthesizer
│   │   ├── CardUtils.js         # Card formatting & value helpers
│   │   └── CardAnimationEngine.js # 3D card flight, arcs, auras & slot highlights
│   ├── components/              # Modular DOM UI components
│   │   ├── Table.js             # Trigonometric round table container & pile manager
│   │   ├── Seat.js              # Player seat with 3-card fan & slot targeting
│   │   ├── Card.js              # 3D flippable card DOM generator
│   │   ├── DrawPile.js          # Stacked draw pile component
│   │   ├── DiscardPile.js       # Discard pile with top-card display
│   │   ├── DrawnCardPanel.js    # Modal action panel for active player turn
│   │   ├── ActionModal.js       # Modals for King, Queen, Jack, Seven action choices
│   │   └── Toast.js             # Non-intrusive floating toast notifications
│   ├── screens/                 # Full-page screens
│   │   ├── LobbyScreen.js       # Create/Join game with 1-tap paste button
│   │   ├── WaitingRoom.js       # Pre-game lobby with bot controls & invite links
│   │   ├── GameScreen.js        # Main game orchestration, HUD & socket handlers
│   │   └── ResultsScreen.js     # Round/Match scoreboard & play-again workflow
│   └── styles/                  # Modular Vanilla CSS
│       ├── index.css            # Design tokens, typography & global reset
│       ├── table.css            # Round green velvet table & responsive seat layout
│       ├── cards.css            # 3D card faces, back patterns & fans
│       └── animations.css       # Keyframes, floating badges, trade arcs & vortexes
└── public/
    └── favicon.svg              # Card suit SVG favicon
\`\`\`

---

## 3. Game State Machine & Lifecycle

The authoritative state resides in \`server/GameManager.js\`. A single game transitions through four primary phases:

1. **\`waiting\`**: Players join via room code or link. Host can add bots and configure match rounds.
2. **\`peek_phase\`**: 3 cards are dealt to each player. Players view their dealt cards and signal readiness via \`peek-done\` (bots automatically signal done). When all players are ready, the phase advances to \`playing\`.
3. **\`playing\`**: Players take turns drawing from the deck. When drawing, they can either:
   - **Swap** with any of their 3 card slots (the displaced card goes to discard).
   - **Discard** the drawn card directly.
   - **Play Action Card immediately** (if King, Queen, Jack, or Seven).
   - **Bank Action Card** into a hand slot to trigger when displaced later.
4. **\`round_over\`**: Triggered when the draw pile is depleted. All cards are revealed, hand totals are scored (lowest total wins). In multi-round matches, cumulative scores are tracked across rounds.

---

## 4. WebSocket Networking Protocol

### Client-to-Server Events
| Event | Payload | Purpose |
|---|---|---|
| \`create-room\` | \`{ playerName, maxPlayers, totalRounds }\` | Create a new room with custom settings |
| \`join-room\` | \`{ roomCode, playerName, playerId?, reconnectToken? }\` | Join room as player or spectator |
| \`reconnect-room\` | \`{ roomCode, playerId, reconnectToken? }\` | Reconnect to existing session with security token |
| \`add-bot\` | \`null\` | Host adds an AI bot to empty seat |
| \`remove-bot\` | \`{ botId }\` | Host removes an AI bot |
| \`start-game\` | \`null\` | Host begins game (deals cards) |
| \`peek-done\` | \`null\` | Player signals completion of initial card peek |
| \`draw-card\` | \`null\` | Active player draws from deck |
| \`swap-card\` | \`{ slotIndex }\` | Active player swaps drawn card into slot 0, 1, or 2 |
| \`discard-drawn\` | \`null\` | Active player discards drawn card |
| \`play-action-immediately\` | \`null\` | Active player activates drawn action card |
| \`resolve-peek-own\` | \`null\` | King resolution (peek own cards) |
| \`resolve-peek-opponent\` | \`{ targetPlayerId }\` | Queen resolution (peek opponent cards) |
| \`resolve-blind-trade\` | \`{ mySlot, targetPlayerId, targetSlot }\` | Jack resolution (blind swap slots) |
| \`resolve-scramble\` | \`{ targetPlayerId }\` | Seven resolution (shuffle opponent cards) |
| \`resolve-triggered-action\` | \`{ actionType, targetPlayerId, mySlot, targetSlot }\` | Displaced action card resolution |
| \`start-next-round\` | \`null\` | Host starts next round in multi-round match |

### Server-to-Client Broadcasts
| Event | Payload | Purpose |
|---|---|---|
| \`game-started\` | \`{ phase, myCards, playerOrder, players, drawPileCount, roundNumber, totalRounds, currentPlayerId }\` | Signals game start & initial deal |
| \`peek-phase-complete\` | \`{ currentPlayerId }\` | Signals end of peek phase |
| \`turn-change\` | \`{ currentPlayerId, drawPileCount }\` | Advances active turn |
| \`player-drew-card\` | \`{ playerId, drawPileCount }\` | Broadcasts draw action |
| \`draw-pile-update\` | \`{ count }\` | Broadcasts updated draw pile card count |
| \`player-swapped\` | \`{ playerId, slotIndex, discardedCard }\` | Broadcasts slot swap & discarded card |
| \`player-discarded\` | \`{ playerId, card }\` | Broadcasts direct discard |
| \`player-played-action\` | \`{ playerId, actionType }\` | Triggers broadcast action banner & FX |
| \`you-were-peeked\` | \`{ byPlayerId }\` | Notifies target player of Queen peek |
| \`blind-trade-complete\` | \`{ playerId, mySlot, targetPlayerId, targetSlot }\` | Dual-slot trade animation & update |
| \`cards-scrambled\` | \`{ playerId, targetPlayerId }\` | Seven scramble animation & memory wipe |
| \`turn-timer-warning\` | \`{ playerId, playerName, seconds }\` | Warning for disconnected player grace period |
| \`player-skipped\` | \`{ playerId, playerName, reason }\` | Broadcasts turn auto-skip on timeout/disconnect |
| \`spectator-count-update\` | \`{ count }\` | Broadcasts current spectator viewer count |
| \`round-over\` | \`{ results }\` | Final round scores & winner reveal |
| \`spectator-game-sync\` | \`{ phase, roundNumber, totalRounds, players, drawPileCount, discardPile, currentPlayerId }\` | Game state sync for spectators |

---

## 5. Action Card Mechanics & Resolution

| Card | Action | Hand Total Value (Lowest Wins) | Effect |
|---|---|---|---|
| **King (K)** | \`peek-own\` | 13 | Secretly view all 3 of your own cards |
| **Queen (Q)** | \`peek-opponent\` | 12 | Secretly view all 3 cards of any chosen opponent |
| **Jack (J)** | \`blind-trade\` | 11 | Swap any 1 of your cards with any 1 of an opponent's cards without looking |
| **Seven (7)** | \`scramble\` | 7 | Randomly shuffle the 3 cards of any chosen opponent (wiping memory) |
| **Ace (A)** | Number | 1 | Lowest regular card (ideal to keep) |
| **2 - 6, 8 - 10** | Number | Face value | Regular number cards (lower is better) |

*Note: In MIND F\*CK, the lowest hand total wins the round. The values above count towards end-of-round penalty totals.*

---

## 6. Trigonometric Table Layout & User-Centric Perspective

The table UI calculates seat positions dynamically around a circular/stadium felt table using polar-to-Cartesian trigonometry in \`src/components/Table.js\`:

\`\`\`javascript
// Current user is always index 0 (positioned at 6 o'clock, bottom of screen)
const relativeIndex = (index - myIndex + numPlayers) % numPlayers;
const angle = (Math.PI / 2) + (2 * Math.PI * relativeIndex) / numPlayers;
const x = 50 + radiusPct * Math.cos(angle);
const y = 50 + radiusPct * Math.sin(angle);
\`\`\`

---

## 7. Procedural Audio Engine

Implemented in \`src/game/SoundEngine.js\` using Web Audio API synthesis (0 external audio files):
- **Card Flip / Deal**: High-frequency bandpass-filtered noise burst with exponential decay.
- **Turn Notification**: Sine wave chord arpeggio (\`C5 -> E5\`).
- **Action Card Activation**: Deep brass / orchestral impact using saw oscillators + lowpass sweep.
- **Trade Whoosh**: Frequency-modulated dual saw sweep across stereophonic space.
- **Scramble Shuffle**: Rapid burst sequence of filtered clicks simulating cards ruffling.
- **Round Win / Lose**: Major vs Minor triadic fanfares.

---

## 8. 3D Flight & Action Animation Engine

Implemented in \`src/game/CardAnimationEngine.js\` & \`src/styles/animations.css\`:
- **Slot-Targeted Swaps**: Displaced cards launch directly from the exact slot index (\`#1 Left\`, \`#2 Mid\`, \`#3 Right\`), with \`.slot-card-replaced\` golden pop and floating badges.
- **Jack Arcing Dual Spirits**: Spirits launch directly from source slot and target slot, arcing over/under with scaling and rotation before landing.
- **Queen Holographic Beam**: Rotated CSS beam calculating Euclidean distance between players with pulsating holographic scanner overlay.
- **Seven Scramble Vortex**: 3D wild physical shuffle keyframes animating all 3 cards swapping positions.

---

## 9. AI Bot Strategy Engine

Implemented in \`server/BotEngine.js\`:
- **Fair Memory Model**: Maintains memory only of its own dealt cards and cards revealed via actions (no omniscient view of human hands).
- **Value Optimization**: Evaluates drawn cards against memory of current slot values.
- **Action Card Heuristics**: Evaluates whether to play immediately or bank for displaced triggers.
- **Strategic Targeting**: Selects trade and peek targets based on observed score totals and unknown cards.
- **Scramble Memory Wiping**: Wipes targeted player's memory model when scrambled.
- **Simulated Latency**: Natural thinking delays (1.0s - 2.2s) with typing/drawing simulation.

---

## 10. Complete Source Code Listing

`;

for (const relPath of fileOrder) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');
  const ext = path.extname(relPath).toLowerCase();

  let lang = 'javascript';
  if (ext === '.json') lang = 'json';
  else if (ext === '.css') lang = 'css';
  else if (ext === '.html') lang = 'html';
  else if (ext === '.svg') lang = 'xml';
  else if (ext === '.md') lang = 'markdown';
  else if (path.basename(relPath) === '.gitignore') lang = 'text';
  else if (relPath.startsWith('.env')) lang = 'shell';

  doc += `### \`${relPath}\`\n\n`;
  doc += '```' + lang + '\n';
  doc += content;
  if (!content.endsWith('\n')) doc += '\n';
  doc += '```\n\n';
  doc += '---\n\n';
}

fs.writeFileSync(path.join(rootDir, 'architecture and source.md'), doc, 'utf8');

console.log(`Successfully generated architecture and source.md (${doc.length} bytes, ${fileOrder.length} files)!`);
