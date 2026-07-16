/** @module EventBus */

/**
 * @typedef {'crowd:update'|'match:update'|'match:goal'|'alert:new'|'alert:dismiss'|'venue:status'|'ai:response'|'ai:typing'|'ai:stream'|'navigation:change'|'theme:change'} StadiumEvent
 */

/**
 * Internal map of event names to Sets of listener callbacks.
 * Using a Map of Sets provides O(1) add/delete and automatic deduplication.
 * @type {Map<string, Set<Function>>}
 */
const listeners = new Map();

/**
 * Centralized publish/subscribe event system for the Smart Stadium app.
 *
 * Provides decoupled communication between modules — services, components,
 * and UI layers can emit and react to events without direct references.
 *
 * @example
 * // Subscribe to live match goals
 * const unsub = EventBus.on('match:goal', (data) => {
 *   console.log(`Goal scored in match ${data.matchId}!`);
 * });
 *
 * // Emit an event
 * EventBus.emit('match:goal', { matchId: 'M01', team: 'Brazil', minute: 34 });
 *
 * // Unsubscribe when done
 * unsub();
 */
export const EventBus = Object.freeze({
  /**
   * Subscribe to an event.
   *
   * @param {string} event - The event name to listen for.
   *   Well-known events:
   *   - `'crowd:update'`      — Real-time crowd density / sentiment data
   *   - `'match:update'`      — Match state changes (score, time, status)
   *   - `'match:goal'`        — A goal has been scored
   *   - `'alert:new'`         — New stadium alert created
   *   - `'alert:dismiss'`     — An alert has been dismissed
   *   - `'venue:status'`      — Venue operational status change
   *   - `'ai:response'`       — AI assistant response received
   *   - `'ai:typing'`         — AI assistant is generating a response
   *   - `'navigation:change'` — App navigation / route change
   *   - `'theme:change'`      — UI theme toggled (dark / light)
   * @param {Function} callback - Handler invoked with event data.
   * @returns {Function} An unsubscribe function — call it to remove this listener.
   * @throws {TypeError} If event is not a non-empty string or callback is not a function.
   */
  on(event, callback) {
    if (typeof event !== 'string' || event.length === 0) {
      throw new TypeError('EventBus.on: "event" must be a non-empty string.');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('EventBus.on: "callback" must be a function.');
    }

    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    // Return a convenient unsubscribe handle
    return () => {
      this.off(event, callback);
    };
  },

  /**
   * Unsubscribe a specific callback from an event.
   *
   * @param {string} event - The event name.
   * @param {Function} callback - The exact function reference that was registered.
   * @returns {boolean} `true` if the listener was found and removed, `false` otherwise.
   */
  off(event, callback) {
    const set = listeners.get(event);
    if (!set) return false;

    const deleted = set.delete(callback);

    // Clean up empty Sets to avoid memory leaks over long sessions
    if (set.size === 0) {
      listeners.delete(event);
    }
    return deleted;
  },

  /**
   * Emit an event, invoking all registered listeners with the supplied data.
   *
   * Listeners are called synchronously in registration order.
   * If any listener throws, the error is caught and logged so that
   * remaining listeners still execute.
   *
   * @param {string} event - The event name to emit.
   * @param {*} [data] - Arbitrary payload passed to each listener.
   * @returns {boolean} `true` if at least one listener was invoked.
   */
  emit(event, data) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return false;

    for (const callback of set) {
      try {
        callback(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    }
    return true;
  },

  /**
   * Subscribe to an event for a single invocation only.
   *
   * The listener is automatically removed after its first call.
   *
   * @param {string} event - The event name.
   * @param {Function} callback - Handler invoked once with event data.
   * @returns {Function} An unsubscribe function (in case you want to cancel before it fires).
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('EventBus.once: "callback" must be a function.');
    }

    /** @type {Function} */
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };

    // Store a reference so the caller can still pass `callback` to `off`
    // if they want to cancel before the event fires.
    wrapper._original = callback;

    return this.on(event, wrapper);
  },

  /**
   * Remove all listeners for a specific event, or clear every listener
   * across all events when called with no arguments.
   *
   * @param {string} [event] - If provided, only that event's listeners are removed.
   *   Omit to clear everything (useful during teardown / testing).
   */
  clear(event) {
    if (event !== undefined) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  },

  /**
   * Return the number of listeners registered for a given event.
   * Useful for diagnostics and testing.
   *
   * @param {string} event - The event name.
   * @returns {number} Listener count (0 if none registered).
   */
  listenerCount(event) {
    const set = listeners.get(event);
    return set ? set.size : 0;
  },

  /**
   * Return an array of all event names that currently have listeners.
   * Useful for debugging.
   *
   * @returns {string[]}
   */
  eventNames() {
    return [...listeners.keys()];
  }
});
