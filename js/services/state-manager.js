/** @module StateManager */

/**
 * @typedef {'matches'|'venues'|'alerts'|'crowd'|'chat'|'ui'} StateSlice
 */

/**
 * Deep-clone a value using structured-clone-safe JSON round-trip.
 * This prevents consumers from mutating internal state.
 *
 * @param {*} value - The value to clone.
 * @returns {*} A deep copy of the value.
 */
function deepClone(value) {
  if (value === undefined) return undefined;
  // structuredClone is available in all modern runtimes (ES2022+)
  try {
    return structuredClone(value);
  } catch {
    // Fallback for edge cases (functions inside state, etc.)
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * Shallow-merge source into target (one level deep).
 * Arrays and primitives are replaced outright; plain objects are merged.
 *
 * @param {Object} target
 * @param {Object} source
 * @returns {Object} The merged result (new object).
 */
function shallowMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    // Merge nested plain objects one level; everything else is replaced
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = { ...tgtVal, ...srcVal };
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Default initial state for every known slice.
 * Used by {@link StateManager.resetState} to restore defaults.
 * @type {Record<string, *>}
 */
const INITIAL_STATE = Object.freeze({
  /** @type {Array<Object>} Active and upcoming matches */
  matches: [],

  /** @type {Array<Object>} Stadium venues */
  venues: [],

  /** @type {Array<Object>} Active alerts / notifications */
  alerts: [],

  /** @type {Object} Real-time crowd analytics */
  crowd: {},

  /** @type {{ messages: Array<Object>, context: Object }} AI chat state */
  chat: { messages: [], context: {} },

  /** @type {{ currentPage: string, sidebarOpen: boolean, theme: string }} UI state */
  ui: { currentPage: 'dashboard', sidebarOpen: false, theme: 'dark' }
});

/**
 * Internal mutable state tree.
 * Each key is a slice name, each value is the slice's current data.
 * @type {Record<string, *>}
 */
const state = {};

/**
 * Per-slice subscriber sets.
 * @type {Map<string, Set<Function>>}
 */
const subscribers = new Map();

// ---- Initialize state from defaults ----
for (const [slice, defaultValue] of Object.entries(INITIAL_STATE)) {
  state[slice] = deepClone(defaultValue);
}

/**
 * Centralized reactive state store for the Smart Stadium application.
 *
 * Design decisions:
 * - **Immutable reads**: `getState` returns a deep clone so consumers
 *   cannot accidentally mutate the store.
 * - **Flexible writes**: `setState` accepts either a partial-merge object
 *   or an updater function `(prev) => next`.
 * - **Per-slice subscriptions**: Listeners only fire when their slice changes,
 *   keeping the notification surface small and performant.
 *
 * @example
 * // Read current matches
 * const matches = StateManager.getState('matches');
 *
 * // Update UI slice with an object merge
 * StateManager.setState('ui', { sidebarOpen: true });
 *
 * // Update with a function
 * StateManager.setState('alerts', (prev) => [...prev, newAlert]);
 *
 * // Subscribe to changes
 * const unsub = StateManager.subscribe('matches', (newMatches) => {
 *   renderMatchList(newMatches);
 * });
 */
export const StateManager = Object.freeze({
  /**
   * Retrieve the current value of a state slice.
   *
   * Returns a **deep clone** to guarantee immutability — callers can
   * freely mutate the returned object without affecting the store.
   *
   * @param {string} slice - The state slice name (e.g. `'matches'`, `'ui'`).
   * @returns {*} A deep clone of the slice data, or `undefined` if the slice doesn't exist.
   */
  getState(slice) {
    if (typeof slice !== 'string' || slice.length === 0) {
      throw new TypeError('StateManager.getState: "slice" must be a non-empty string.');
    }
    return deepClone(state[slice]);
  },

  /**
   * Update a state slice and notify subscribers.
   *
   * @param {string} slice - The state slice name.
   * @param {Object|Function} updater
   *   - If an **object**, it is shallow-merged into the current slice value
   *     (works well for object slices like `'ui'` or `'chat'`).
   *   - If a **function**, it receives a deep clone of the current value and
   *     must return the new value (works well for array slices like `'matches'`).
   * @throws {TypeError} If slice is invalid or updater is neither object nor function.
   */
  setState(slice, updater) {
    if (typeof slice !== 'string' || slice.length === 0) {
      throw new TypeError('StateManager.setState: "slice" must be a non-empty string.');
    }
    if (updater === null || (typeof updater !== 'object' && typeof updater !== 'function')) {
      throw new TypeError(
        'StateManager.setState: "updater" must be a plain object (merge) or a function (prev => next).'
      );
    }

    const prev = state[slice];
    /** @type {*} */
    let next;

    if (typeof updater === 'function') {
      // Pass a deep clone so the updater can't mutate internal state
      next = updater(deepClone(prev));
    } else if (prev !== null && typeof prev === 'object' && !Array.isArray(prev)) {
      // Object merge
      next = shallowMerge(prev, updater);
    } else {
      // For array or primitive slices, replace outright
      next = updater;
    }

    state[slice] = next;
    this._notify(slice);
  },

  /**
   * Subscribe to changes on a specific state slice.
   *
   * The callback is invoked with a deep clone of the new slice value
   * every time `setState` writes to that slice.
   *
   * @param {string} slice - The state slice to watch.
   * @param {Function} callback - `(newValue: *) => void`
   * @returns {Function} Unsubscribe function.
   * @throws {TypeError} If arguments are invalid.
   */
  subscribe(slice, callback) {
    if (typeof slice !== 'string' || slice.length === 0) {
      throw new TypeError('StateManager.subscribe: "slice" must be a non-empty string.');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('StateManager.subscribe: "callback" must be a function.');
    }

    if (!subscribers.has(slice)) {
      subscribers.set(slice, new Set());
    }
    subscribers.get(slice).add(callback);

    return () => {
      const set = subscribers.get(slice);
      if (set) {
        set.delete(callback);
        if (set.size === 0) subscribers.delete(slice);
      }
    };
  },

  /**
   * Reset a single slice to its initial default value, or reset all
   * slices when called with no arguments.
   *
   * Subscribers are notified after reset.
   *
   * @param {string} [slice] - Slice to reset. Omit to reset everything.
   */
  resetState(slice) {
    if (slice !== undefined) {
      if (INITIAL_STATE[slice] !== undefined) {
        state[slice] = deepClone(INITIAL_STATE[slice]);
      } else {
        delete state[slice];
      }
      this._notify(slice);
    } else {
      for (const key of Object.keys(INITIAL_STATE)) {
        state[key] = deepClone(INITIAL_STATE[key]);
        this._notify(key);
      }
      // Remove any dynamic slices that aren't in INITIAL_STATE
      for (const key of Object.keys(state)) {
        if (!(key in INITIAL_STATE)) {
          delete state[key];
        }
      }
    }
  },

  /**
   * Return a deep clone of the entire state tree.
   * **Intended for debugging and dev-tools only** — prefer `getState(slice)`
   * for production reads.
   *
   * @returns {Record<string, *>}
   */
  getFullState() {
    return deepClone(state);
  },

  /**
   * Check whether a slice exists in the store.
   *
   * @param {string} slice
   * @returns {boolean}
   */
  hasSlice(slice) {
    return slice in state;
  },

  // ---- Private helpers ----

  /**
   * Notify all subscribers of a given slice.
   * Errors in individual callbacks are caught and logged.
   *
   * @param {string} slice
   * @private
   */
  _notify(slice) {
    const set = subscribers.get(slice);
    if (!set || set.size === 0) return;

    const snapshot = deepClone(state[slice]);
    for (const cb of set) {
      try {
        cb(snapshot);
      } catch (err) {
        console.error(`[StateManager] Subscriber error for slice "${slice}":`, err);
      }
    }
  }
});
