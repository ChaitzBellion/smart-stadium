/** @module Security */

/**
 * Map of characters to their HTML entity replacements.
 * Covers the OWASP-recommended set for XSS prevention.
 * @type {Record<string, string>}
 */
const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '/': '&#x2F;'
});

/**
 * Pre-compiled regex matching any character that needs HTML escaping.
 * @type {RegExp}
 */
const HTML_ESCAPE_RE = /[&<>"'`/]/g;

/**
 * Allowed URL protocols for sanitizeURL.
 * @type {Set<string>}
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Security utilities for the Smart Stadium application.
 *
 * All public methods are pure functions (except `createRateLimiter` which
 * returns a stateful closure). None of them touch the DOM directly, making
 * them easy to unit-test.
 *
 * @example
 * import { Security } from './security.js';
 *
 * const safe = Security.escapeHTML('<script>alert("xss")</script>');
 * // '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
 */
export const Security = Object.freeze({
  /**
   * Escape HTML entities to prevent Cross-Site Scripting (XSS).
   *
   * Handles the seven dangerous characters recommended by OWASP:
   * `& < > " ' \` /`
   *
   * @param {string} str - Raw string to escape.
   * @returns {string} Escaped string safe for insertion into HTML.
   */
  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(HTML_ESCAPE_RE, (char) => HTML_ESCAPE_MAP[char]);
  },

  /**
   * Sanitize a URL, allowing only `http:`, `https:`, and relative paths.
   *
   * Blocks `javascript:`, `data:`, `vbscript:`, and any other exotic protocol
   * that could be used for XSS or data exfiltration.
   *
   * @param {string} url - The URL to validate.
   * @returns {string} The original URL if safe, or an empty string if rejected.
   *
   * @example
   * Security.sanitizeURL('https://fifa.com/matches'); // 'https://fifa.com/matches'
   * Security.sanitizeURL('javascript:alert(1)');       // ''
   * Security.sanitizeURL('/venues/lusail');             // '/venues/lusail'
   */
  sanitizeURL(url) {
    if (typeof url !== 'string') return '';

    const trimmed = url.trim();
    if (trimmed.length === 0) return '';

    // Relative URLs (start with / or are path-only) are safe
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return trimmed;
    }

    // Fragment-only or query-only references
    if (trimmed.startsWith('#') || trimmed.startsWith('?')) {
      return trimmed;
    }

    // Absolute URLs — validate protocol
    try {
      const parsed = new URL(trimmed);
      if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        return trimmed;
      }
      return '';
    } catch {
      // If URL constructor throws, it's either malformed or protocol-relative.
      // Allow protocol-relative URLs (//example.com/path)
      if (trimmed.startsWith('//')) {
        return trimmed;
      }
      return '';
    }
  },

  /**
   * Validate and sanitize free-form user text input.
   *
   * Pipeline: trim → enforce max length → escape HTML entities.
   *
   * @param {string} str - Raw user input.
   * @param {number} [maxLength=500] - Maximum allowed character count after trimming.
   * @returns {string} Sanitized string.
   */
  sanitizeInput(str, maxLength = 500) {
    if (typeof str !== 'string') return '';

    let result = str.trim();

    if (result.length > maxLength) {
      result = result.slice(0, maxLength);
    }

    return this.escapeHTML(result);
  },

  /**
   * Create a sliding-window rate limiter.
   *
   * Uses a simple token-bucket approach: up to `maxCalls` invocations are
   * allowed within each `windowMs` window. Timestamps older than the window
   * are pruned on every `check()` call.
   *
   * @param {number} maxCalls - Maximum number of calls allowed in the window.
   * @param {number} windowMs - Duration of the sliding window in milliseconds.
   * @returns {{ check: () => boolean, reset: () => void, remaining: () => number }}
   *   - `check()` — returns `true` if the call is allowed, `false` if rate-limited.
   *   - `reset()` — clears the call history.
   *   - `remaining()` — returns how many calls are still allowed in the current window.
   *
   * @example
   * const limiter = Security.createRateLimiter(5, 60_000); // 5 per minute
   * if (limiter.check()) {
   *   sendMessage(text);
   * } else {
   *   Toast.warning('Slow down! Too many messages.');
   * }
   */
  createRateLimiter(maxCalls, windowMs) {
    if (!Number.isFinite(maxCalls) || maxCalls < 1) {
      throw new RangeError('createRateLimiter: maxCalls must be a positive integer.');
    }
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw new RangeError('createRateLimiter: windowMs must be a positive number.');
    }

    /** @type {number[]} Timestamps of accepted calls */
    let timestamps = [];

    /**
     * Remove timestamps outside the current sliding window.
     */
    function prune() {
      const cutoff = Date.now() - windowMs;
      timestamps = timestamps.filter((t) => t > cutoff);
    }

    return {
      /**
       * Attempt to make a call. Returns `true` if under the limit.
       * @returns {boolean}
       */
      check() {
        prune();
        if (timestamps.length < maxCalls) {
          timestamps.push(Date.now());
          return true;
        }
        return false;
      },

      /**
       * Reset all recorded calls.
       */
      reset() {
        timestamps = [];
      },

      /**
       * How many calls remain before hitting the limit.
       * @returns {number}
       */
      remaining() {
        prune();
        return Math.max(0, maxCalls - timestamps.length);
      }
    };
  },

  /**
   * Generate a cryptographically random nonce string for Content Security Policy.
   *
   * The nonce is a base-64-encoded 16-byte random value, suitable for use
   * in CSP `script-src` / `style-src` directives.
   *
   * Falls back to `Math.random` if `crypto.getRandomValues` is unavailable
   * (e.g. in non-secure contexts), but logs a warning.
   *
   * @returns {string} A base-64 nonce string (24 characters).
   */
  generateNonce() {
    try {
      const bytes = new Uint8Array(18); // 18 bytes → 24 base-64 chars (no padding)
      crypto.getRandomValues(bytes);
      // Convert to base64 in the browser
      return btoa(String.fromCharCode(...bytes));
    } catch {
      console.warn(
        '[Security] crypto.getRandomValues unavailable — falling back to Math.random. ' +
        'This is NOT cryptographically secure.'
      );
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let nonce = '';
      for (let i = 0; i < 24; i++) {
        nonce += chars[Math.floor(Math.random() * chars.length)];
      }
      return nonce;
    }
  },

  /**
   * Validate that a value matches an expected JavaScript type.
   *
   * Supports standard `typeof` strings plus extended checks:
   * - `'array'`  — `Array.isArray(value)`
   * - `'null'`   — `value === null`
   * - `'date'`   — `value instanceof Date && !isNaN(value)`
   * - `'integer'`— `Number.isInteger(value)`
   *
   * @param {*} value - The value to check.
   * @param {string} expectedType - Expected type name
   *   (`'string'`, `'number'`, `'boolean'`, `'object'`, `'function'`,
   *    `'array'`, `'null'`, `'undefined'`, `'date'`, `'integer'`).
   * @returns {boolean} `true` if the value matches the expected type.
   *
   * @example
   * Security.validateType(42, 'number');   // true
   * Security.validateType([1], 'array');   // true
   * Security.validateType(null, 'object'); // false (explicit null check)
   */
  validateType(value, expectedType) {
    if (typeof expectedType !== 'string') return false;

    switch (expectedType.toLowerCase()) {
      case 'array':
        return Array.isArray(value);
      case 'null':
        return value === null;
      case 'date':
        return value instanceof Date && !Number.isNaN(value.getTime());
      case 'integer':
        return Number.isInteger(value);
      case 'object':
        // Distinguish plain objects from null and arrays
        return value !== null && typeof value === 'object' && !Array.isArray(value);
      default:
        return typeof value === expectedType;
    }
  }
});
