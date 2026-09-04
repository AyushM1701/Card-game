// src/game/SocketClient.js — Socket.IO client wrapper

import { io } from 'socket.io-client';

class SocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    // Re-bind all registered custom listeners
    this.listeners.forEach((handlers, event) => {
      if (!event.startsWith('_')) {
        handlers.forEach(handler => {
          this.socket.on(event, handler);
        });
      }
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket] Connected:', this.socket.id);
      this._emit('_connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('[Socket] Disconnected:', reason);
      this._emit('_disconnected', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      this._emit('_error', err);
    });

    this.socket.on('error', (err) => {
      console.error('[Socket] Socket error:', err?.message || err);
      this._emit('_error', err);
    });
  }

  /**
   * Emit an event with optional callback.
   */
  emit(event, data, callback) {
    if (!this.socket) {
      console.error('[Socket] Not connected');
      return;
    }
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen for a server event.
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);

    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  /**
   * Remove a specific listener.
   */
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  /**
   * Internal: emit to local listeners.
   */
  _emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(data);
        } catch (e) {
          console.error(`[SocketClient] Error in listener for "${event}":`, e);
        }
      });
    }
  }

  /**
   * Disconnect and clean up.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

// Singleton
const socketClient = new SocketClient();
export default socketClient;
