// src/game/CardAnimationEngine.js — Dynamic 3D Card Flight & Action Visual FX

import { createCard, createCardBack } from '../components/Card.js';
import clientState from './ClientState.js';
import soundEngine from './SoundEngine.js';

class CardAnimationEngine {
  constructor() {
    this.overlay = null;
    this.activeTimeouts = new Set();
  }

  _setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.activeTimeouts.delete(id);
      fn();
    }, delay);
    this.activeTimeouts.add(id);
    return id;
  }

  clearAnimations() {
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts.clear();
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
  }

  _getOverlay() {
    if (!this.overlay || !document.body.contains(this.overlay)) {
      this.overlay = document.getElementById('card-animation-layer');
      if (!this.overlay) {
        this.overlay = document.createElement('div');
        this.overlay.id = 'card-animation-layer';
        this.overlay.className = 'card-animation-layer';
        document.body.appendChild(this.overlay);
      }
    }
    return this.overlay;
  }

  /**
   * Fly a card from source element/rect to target element/rect with 3D flip
   */
  animateCardFly({ fromEl, toEl, card = null, faceUp = false, duration = 600, onComplete = null }) {
    const layer = this._getOverlay();
    if (!fromEl || !toEl) {
      onComplete?.();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const endX = toRect.left + toRect.width / 2;
    const endY = toRect.top + toRect.height / 2;

    // Create flying card
    const flyer = document.createElement('div');
    flyer.className = `flying-card ${faceUp ? 'flipped' : ''}`;
    flyer.style.setProperty('--card-width', `${Math.min(fromRect.width || 60, 70)}px`);
    flyer.style.setProperty('--card-height', `${Math.min(fromRect.height || 85, 100)}px`);

    const cardInner = createCard(card, { faceUp: false }).querySelector('.card-inner');
    if (cardInner) {
      flyer.appendChild(cardInner.cloneNode(true));
    } else {
      flyer.appendChild(createCardBack());
    }

    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.transform = 'translate(-50%, -50%) scale(0.9) rotate(0deg)';
    layer.appendChild(flyer);

    // Trigger flip during flight if faceUp is requested
    if (faceUp) {
      this._setTimeout(() => {
        flyer.classList.add('flipped');
      }, duration * 0.3);
    }

    // Trigger flight animation
    requestAnimationFrame(() => {
      flyer.style.transition = `all ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      flyer.style.left = `${endX}px`;
      flyer.style.top = `${endY}px`;
      flyer.style.transform = `translate(-50%, -50%) scale(1.05) rotate(${(Math.random() - 0.5) * 15}deg)`;
    });

    this._setTimeout(() => {
      flyer.remove();
      onComplete?.();
    }, duration + 30);
  }

  /**
   * Animate a player drawing a card from the draw pile
   */
  animateDraw({ playerId, card = null, isUser = false, onComplete = null }) {
    const drawPileEl = document.getElementById('draw-pile');
    const targetSeatEl = document.getElementById(`seat-${playerId}`);

    soundEngine.cardDeal();

    if (!drawPileEl || !targetSeatEl) {
      onComplete?.();
      return;
    }

    this.animateCardFly({
      fromEl: drawPileEl,
      toEl: targetSeatEl,
      card,
      faceUp: isUser && !!card,
      duration: 550,
      onComplete: () => {
        soundEngine.cardFlip();
        onComplete?.();
      }
    });
  }

  /**
   * Animate a player discarding a card
   */
  animateDiscard({ playerId, card, onComplete = null }) {
    const seatEl = document.getElementById(`seat-${playerId}`);
    const discardPileEl = document.getElementById('discard-pile');

    if (!seatEl || !discardPileEl) {
      onComplete?.();
      return;
    }

    soundEngine.cardDeal();

    this.animateCardFly({
      fromEl: seatEl,
      toEl: discardPileEl,
      card,
      faceUp: true,
      duration: 500,
      onComplete: () => {
        soundEngine.cardFlip();
        onComplete?.();
      }
    });
  }

  _getSlotElement(playerId, slotIndex) {
    const seatEl = document.getElementById(`seat-${playerId}`);
    if (!seatEl) return null;
    if (slotIndex !== undefined && slotIndex !== null) {
      const cardEl = seatEl.querySelector(`.card-fan .card[data-slot-index="${slotIndex}"]`);
      if (cardEl) return cardEl;
      const allCards = seatEl.querySelectorAll('.card-fan .card');
      if (allCards && allCards[slotIndex]) return allCards[slotIndex];
    }
    return seatEl;
  }

  _spawnSlotBadge(targetEl, text, type = 'swap') {
    if (!targetEl || !targetEl.classList.contains('card')) return;
    const badge = document.createElement('div');
    badge.className = `slot-action-badge badge-${type}`;
    badge.textContent = text;
    targetEl.appendChild(badge);
    this._setTimeout(() => badge.remove(), 1900);
  }

  /**
   * Animate a player swapping a card (displaced goes to discard)
   * Visually highlights the exact card slot in that player's hand for all players.
   */
  animateSwap({ playerId, slotIndex, card, displacedCard, onComplete = null }) {
    const slotEl = this._getSlotElement(playerId, slotIndex);
    const seatEl = document.getElementById(`seat-${playerId}`);
    const fromEl = slotEl || seatEl;
    const discardPileEl = document.getElementById('discard-pile');

    // Visually highlight the specific slot card in the player's hand for everyone
    if (slotEl && slotEl !== seatEl) {
      slotEl.classList.add('slot-card-replaced');
      const slotLabel = ['#1 Left', '#2 Mid', '#3 Right'][slotIndex] || `#${(slotIndex ?? 0) + 1}`;
      this._spawnSlotBadge(slotEl, `🔄 SWAP ${slotLabel}`, 'swap');
      this._setTimeout(() => {
        slotEl.classList.remove('slot-card-replaced');
      }, 1400);
    }

    // Displaced card flies to discard pile directly from that slot
    if (fromEl && discardPileEl && displacedCard) {
      this.animateCardFly({
        fromEl,
        toEl: discardPileEl,
        card: displacedCard,
        faceUp: true,
        duration: 580,
        onComplete
      });
    } else {
      onComplete?.();
    }
  }

  /**
   * Show dramatic full-table Action Card animation visible to all players
   */
  triggerActionFX({ actionType, sourcePlayerId, targetPlayerId = null, extra = null }) {
    const sourceName = clientState.getPlayerName(sourcePlayerId);
    const targetName = targetPlayerId ? clientState.getPlayerName(targetPlayerId) : '';

    // 1. Show Action Banner with extra slot context
    this.showActionBanner(actionType, sourceName, targetName, extra);

    // 2. Play Sound
    soundEngine.actionCard();

    // 3. Render specific visual FX
    const sourceSeat = document.getElementById(`seat-${sourcePlayerId}`);
    const targetSeat = targetPlayerId ? document.getElementById(`seat-${targetPlayerId}`) : null;

    switch (actionType) {
      case 'peek-own':
        if (sourceSeat) {
          this._renderKingAura(sourceSeat);
        }
        break;

      case 'peek-opponent':
        if (sourceSeat && targetSeat) {
          this._renderQueenScan(sourceSeat, targetSeat, extra?.slotIndex);
        }
        break;

      case 'blind-trade':
        if (sourceSeat && targetSeat) {
          this._renderJackTrade(sourcePlayerId, targetPlayerId, extra?.mySlot, extra?.targetSlot);
        }
        break;

      case 'scramble':
        if (targetSeat) {
          this._renderSevenScramble(targetSeat);
        }
        break;
    }
  }

  showActionBanner(actionType, sourceName, targetName, extra = null) {
    const layer = this._getOverlay();

    const banner = document.createElement('div');
    banner.className = `action-broadcast-banner action-${actionType}`;

    const icons = {
      'peek-own': '👑 KING: PEEK OWN',
      'peek-opponent': '👸 QUEEN: PEEK OPPONENT',
      'blind-trade': '🃏 JACK: BLIND TRADE',
      'scramble': '🔀 SEVEN: SCRAMBLE'
    };

    const slotNames = ['Card #1 (Left)', 'Card #2 (Middle)', 'Card #3 (Right)'];
    const sSlot = extra?.mySlot !== undefined ? (slotNames[extra.mySlot] || `Card #${extra.mySlot + 1}`) : 'a card';
    const tSlot = extra?.targetSlot !== undefined ? (slotNames[extra.targetSlot] || `Card #${extra.targetSlot + 1}`) : 'a card';

    const details = {
      'peek-own': `${sourceName} is peeking at their own cards`,
      'peek-opponent': targetName ? `${sourceName} is peeking at all of ${targetName}'s cards` : `${sourceName} is choosing an opponent to peek`,
      'blind-trade': targetName ? `${sourceName} traded ${sSlot} with ${targetName}'s ${tSlot}` : `${sourceName} is initiating a Blind Trade`,
      'scramble': targetName ? `${sourceName} scrambled all of ${targetName}'s cards!` : `${sourceName} is choosing an opponent to scramble`
    };

    const titleEl = document.createElement('div');
    titleEl.className = 'banner-title';
    titleEl.textContent = icons[actionType] || actionType;

    const descEl = document.createElement('div');
    descEl.className = 'banner-desc';
    descEl.textContent = details[actionType] || '';

    banner.appendChild(titleEl);
    banner.appendChild(descEl);

    layer.appendChild(banner);

    this._setTimeout(() => {
      banner.classList.add('banner-exit');
      this._setTimeout(() => banner.remove(), 400);
    }, 2400);
  }

  _renderKingAura(seatEl) {
    const halo = document.createElement('div');
    halo.className = 'king-royal-halo';
    seatEl.appendChild(halo);

    this._setTimeout(() => {
      halo.remove();
    }, 2500);
  }

  _renderQueenScan(sourceEl, targetEl, slotIndex = null) {
    const layer = this._getOverlay();
    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    const beam = document.createElement('div');
    beam.className = 'queen-scan-beam';

    const dx = (tRect.left + tRect.width / 2) - (sRect.left + sRect.width / 2);
    const dy = (tRect.top + tRect.height / 2) - (sRect.top + sRect.height / 2);
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    beam.style.left = `${sRect.left + sRect.width / 2}px`;
    beam.style.top = `${sRect.top + sRect.height / 2}px`;
    beam.style.width = `${dist}px`;
    beam.style.transform = `rotate(${angle}deg)`;

    layer.appendChild(beam);

    // Pulse target card fan
    const targetFan = targetEl.querySelector('.card-fan');
    if (targetFan) {
      targetFan.classList.add('queen-targeted-fan');
      this._setTimeout(() => targetFan.classList.remove('queen-targeted-fan'), 2000);
    }

    this._setTimeout(() => beam.remove(), 1600);
  }

  _renderJackTrade(sourcePlayerId, targetPlayerId, sourceSlot = null, targetSlot = null) {
    soundEngine.trade();
    const layer = this._getOverlay();

    const sourceEl = this._getSlotElement(sourcePlayerId, sourceSlot);
    const targetEl = this._getSlotElement(targetPlayerId, targetSlot);

    if (!sourceEl || !targetEl) return;

    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    const slotNames = ['#1 Left', '#2 Mid', '#3 Right'];
    const sLabel = sourceSlot !== null && sourceSlot !== undefined ? (slotNames[sourceSlot] || `#${sourceSlot + 1}`) : '';
    const tLabel = targetSlot !== null && targetSlot !== undefined ? (slotNames[targetSlot] || `#${targetSlot + 1}`) : '';

    // Pulse the exact traded cards and spawn floating badges
    if (sourceEl.classList.contains('card')) {
      sourceEl.classList.add('slot-card-traded');
      this._spawnSlotBadge(sourceEl, `🔄 GIVING ${sLabel}`, 'trade');
      this._setTimeout(() => sourceEl.classList.remove('slot-card-traded'), 1600);
    }

    if (targetEl.classList.contains('card')) {
      targetEl.classList.add('slot-card-traded');
      this._spawnSlotBadge(targetEl, `🔄 GETTING ${tLabel}`, 'trade');
      this._setTimeout(() => targetEl.classList.remove('slot-card-traded'), 1600);
    }

    // Two card spirits flying in arcing paths directly between the two specific card slots
    const card1 = document.createElement('div');
    card1.className = 'trade-spirit trade-spirit-1';
    card1.style.left = `${sRect.left + sRect.width / 2}px`;
    card1.style.top = `${sRect.top + sRect.height / 2}px`;

    const card2 = document.createElement('div');
    card2.className = 'trade-spirit trade-spirit-2';
    card2.style.left = `${tRect.left + tRect.width / 2}px`;
    card2.style.top = `${tRect.top + tRect.height / 2}px`;

    layer.appendChild(card1);
    layer.appendChild(card2);

    // Transition left/top to swap positions while CSS animation handles arc
    requestAnimationFrame(() => {
      card1.style.transition = 'left 800ms cubic-bezier(0.34, 1.56, 0.64, 1), top 800ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      card1.style.left = `${tRect.left + tRect.width / 2}px`;
      card1.style.top = `${tRect.top + tRect.height / 2}px`;

      card2.style.transition = 'left 800ms cubic-bezier(0.34, 1.56, 0.64, 1), top 800ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      card2.style.left = `${sRect.left + sRect.width / 2}px`;
      card2.style.top = `${sRect.top + sRect.height / 2}px`;
    });

    this._setTimeout(() => {
      card1.remove();
      card2.remove();
    }, 900);
  }

  _renderSevenScramble(targetEl) {
    soundEngine.scramble();
    soundEngine.cardShuffle();

    const fan = targetEl.querySelector('.card-fan');
    if (fan) {
      fan.classList.add('card-scrambling-wild');

      // Add spinning vortex
      const vortex = document.createElement('div');
      vortex.className = 'scramble-vortex';
      fan.appendChild(vortex);

      this._setTimeout(() => {
        fan.classList.remove('card-scrambling-wild');
        vortex.remove();
      }, 1500);
    }
  }
}

const cardAnimationEngine = new CardAnimationEngine();
export default cardAnimationEngine;
