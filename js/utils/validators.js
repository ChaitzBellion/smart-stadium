/** @module Validators */

import { Security } from '../services/security.js';

/**
 * Check whether a value is a non-empty string (after trimming).
 *
 * @param {*} val - Value to test.
 * @returns {boolean} `true` if `val` is a string with at least one non-whitespace character.
 *
 * @example
 * isNonEmptyString('hello'); // true
 * isNonEmptyString('  ');    // false
 * isNonEmptyString(42);      // false
 */
export function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Check whether a value is a finite positive number (> 0).
 *
 * @param {*} val - Value to test.
 * @returns {boolean} `true` if `val` is a number greater than zero and not `NaN` / `Infinity`.
 *
 * @example
 * isPositiveNumber(42);    // true
 * isPositiveNumber(0);     // false
 * isPositiveNumber(-3);    // false
 * isPositiveNumber('10');  // false (string, not number)
 */
export function isPositiveNumber(val) {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

/**
 * Validate an email address against RFC 5322 simplified rules.
 *
 * This regex covers the vast majority of real-world addresses without
 * attempting full RFC compliance (which requires a parser, not a regex).
 *
 * @param {*} val - Value to test.
 * @returns {boolean} `true` if `val` looks like a valid email address.
 *
 * @example
 * isValidEmail('fan@fifa.com');       // true
 * isValidEmail('user@sub.domain.co'); // true
 * isValidEmail('not-an-email');       // false
 * isValidEmail('');                   // false
 */
export function isValidEmail(val) {
  if (typeof val !== 'string') return false;

  // Simplified RFC 5322-ish pattern:
  // local part: one or more chars (letters, digits, ._%+-)
  // @ symbol
  // domain: labels separated by dots, TLD at least 2 chars
  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  return EMAIL_RE.test(val.trim());
}

/**
 * Check whether a numeric value falls within an inclusive range.
 *
 * @param {*} val - Value to test.
 * @param {number} min - Lower bound (inclusive).
 * @param {number} max - Upper bound (inclusive).
 * @returns {boolean} `true` if `val` is a finite number and `min <= val <= max`.
 *
 * @example
 * isInRange(50, 0, 100);  // true
 * isInRange(0, 0, 100);   // true (inclusive)
 * isInRange(101, 0, 100); // false
 */
export function isInRange(val, min, max) {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

/**
 * Check whether a value can be parsed as a valid date.
 *
 * Accepts `Date` objects, ISO date strings, and numeric timestamps.
 *
 * @param {*} val - Value to test.
 * @returns {boolean} `true` if `val` represents a valid date.
 *
 * @example
 * isValidDate(new Date());          // true
 * isValidDate('2026-07-15');        // true
 * isValidDate('not-a-date');        // false
 * isValidDate(new Date('invalid')); // false
 */
export function isValidDate(val) {
  if (val === null || val === undefined) return false;

  if (val instanceof Date) {
    return !Number.isNaN(val.getTime());
  }

  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return !Number.isNaN(d.getTime());
  }

  return false;
}

/**
 * Validate a venue ID against a list of known venues.
 *
 * Each venue object in the array is expected to have an `id` property.
 *
 * @param {*} val - The venue ID to look up.
 * @param {Array<{ id: string|number }>} venues - Array of venue objects.
 * @returns {boolean} `true` if a venue with the given ID exists.
 *
 * @example
 * const venues = [{ id: 'lusail' }, { id: 'al-bayt' }];
 * isValidVenueId('lusail', venues);   // true
 * isValidVenueId('unknown', venues);  // false
 */
export function isValidVenueId(val, venues) {
  if (val === null || val === undefined) return false;
  if (!Array.isArray(venues)) return false;

  return venues.some((venue) => venue && venue.id === val);
}

/**
 * @typedef {Object} ChatValidationResult
 * @property {boolean} valid   - Whether the message passed validation.
 * @property {string|null} error - Human-readable error message, or `null` if valid.
 * @property {string|null} sanitized - Sanitized message text, or `null` if invalid.
 */

/**
 * Validate and sanitize a chat message for the AI assistant.
 *
 * Validation rules:
 * 1. Must be a non-empty string.
 * 2. Must not exceed 2 000 characters (after trimming).
 * 3. Must contain at least one alphanumeric character.
 * 4. HTML entities are escaped for safe rendering.
 *
 * @param {*} msg - Raw chat message input.
 * @returns {ChatValidationResult} Structured result with validity, error, and sanitized text.
 *
 * @example
 * validateChatMessage('Hello, AI!');
 * // { valid: true, error: null, sanitized: 'Hello, AI!' }
 *
 * validateChatMessage('');
 * // { valid: false, error: 'Message cannot be empty.', sanitized: null }
 *
 * validateChatMessage('<script>alert(1)</script>');
 * // { valid: true, error: null, sanitized: '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;' }
 */
export function validateChatMessage(msg) {
  const MAX_LENGTH = 2000;

  // Type check
  if (typeof msg !== 'string') {
    return { valid: false, error: 'Message must be a string.', sanitized: null };
  }

  const trimmed = msg.trim();

  // Empty check
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.', sanitized: null };
  }

  // Length check
  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_LENGTH} characters.`,
      sanitized: null
    };
  }

  // Must contain at least one alphanumeric character (prevents messages like "!!!")
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Message must contain at least one letter or number.',
      sanitized: null
    };
  }

  // Sanitize for safe rendering
  const sanitized = Security.sanitizeInput(trimmed, MAX_LENGTH);

  return { valid: true, error: null, sanitized };
}
