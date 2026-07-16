/** @module Formatters */

/**
 * Format a number with locale-aware thousands separators.
 *
 * @param {number} n - The number to format.
 * @returns {string} Formatted string (e.g. `1234` → `"1,234"`).
 *
 * @example
 * formatNumber(1234567); // "1,234,567"
 * formatNumber(42);      // "42"
 */
export function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

/**
 * Format a number in compact notation (K / M / B / T).
 *
 * Uses one decimal place for values ≥ 1 000 and drops the decimal
 * when it would be ".0".
 *
 * @param {number} n - The number to format.
 * @returns {string} Compact string (e.g. `12500` → `"12.5K"`).
 *
 * @example
 * formatCompactNumber(999);        // "999"
 * formatCompactNumber(12500);      // "12.5K"
 * formatCompactNumber(1_000_000);  // "1M"
 * formatCompactNumber(2_345_678_000); // "2.3B"
 */
export function formatCompactNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  /** @type {Array<[number, string]>} */
  const tiers = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ];

  for (const [threshold, suffix] of tiers) {
    if (abs >= threshold) {
      const value = abs / threshold;
      // Use 1 decimal, strip trailing .0
      const formatted = value.toFixed(1).replace(/\.0$/, '');
      return `${sign}${formatted}${suffix}`;
    }
  }

  return `${sign}${abs}`;
}

/**
 * Format a decimal value as a percentage string.
 *
 * @param {number} n - Fraction (e.g. `0.856` for 85.6%).
 * @param {number} [decimals=1] - Number of decimal places.
 * @returns {string} Percentage string (e.g. `"85.6%"`).
 *
 * @example
 * formatPercentage(0.856);    // "85.6%"
 * formatPercentage(1, 0);     // "100%"
 * formatPercentage(0.3333, 2); // "33.33%"
 */
export function formatPercentage(n, decimals = 1) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(decimals)}%`;
}

/**
 * Safely coerce a value to a `Date` instance.
 *
 * @param {Date|string|number} value
 * @returns {Date|null} A valid Date or null.
 * @private
 */
function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date according to a named format preset.
 *
 * | Format    | Example Output          |
 * |-----------|-------------------------|
 * | `'short'` | `"Jul 15, 2026"`        |
 * | `'long'`  | `"July 15, 2026"`       |
 * | `'iso'`   | `"2026-07-15"`          |
 * | `'full'`  | `"Wednesday, July 15, 2026"` |
 *
 * @param {Date|string|number} date - Date value.
 * @param {'short'|'long'|'iso'|'full'} [format='short'] - Named format preset.
 * @returns {string} Formatted date string, or `'Invalid date'`.
 */
export function formatDate(date, format = 'short') {
  const d = toDate(date);
  if (!d) return 'Invalid date';

  switch (format) {
    case 'iso':
      return d.toISOString().slice(0, 10);

    case 'long':
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    case 'full':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    case 'short':
    default:
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
  }
}

/**
 * Format a date as a 24-hour time string (`"HH:MM"`).
 *
 * @param {Date|string|number} date - Date value.
 * @returns {string} Time string (e.g. `"14:30"`), or `'Invalid date'`.
 */
export function formatTime(date) {
  const d = toDate(date);
  if (!d) return 'Invalid date';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a date as a combined date-time string.
 *
 * @param {Date|string|number} date - Date value.
 * @returns {string} e.g. `"Jul 15, 2026 14:30"`, or `'Invalid date'`.
 */
export function formatDateTime(date) {
  const d = toDate(date);
  if (!d) return 'Invalid date';

  return `${formatDate(d, 'short')} ${formatTime(d)}`;
}

/**
 * Return a human-readable relative time string ("time ago").
 *
 * @param {Date|string|number} date - The past date to compare against now.
 * @returns {string} Relative string (e.g. `"5 minutes ago"`, `"just now"`).
 *
 * @example
 * timeAgo(Date.now() - 30_000);     // "30 seconds ago"
 * timeAgo(Date.now() - 3_600_000);  // "1 hour ago"
 * timeAgo(Date.now() - 90_000_000); // "1 day ago"
 */
export function timeAgo(date) {
  const d = toDate(date);
  if (!d) return 'Invalid date';

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 0) return 'in the future';
  if (seconds < 5) return 'just now';

  /** @type {Array<[number, string, string]>} [threshold, singular, plural] */
  const intervals = [
    [31_536_000, 'year', 'years'],
    [2_592_000, 'month', 'months'],
    [604_800, 'week', 'weeks'],
    [86_400, 'day', 'days'],
    [3_600, 'hour', 'hours'],
    [60, 'minute', 'minutes'],
    [1, 'second', 'seconds']
  ];

  for (const [threshold, singular, plural] of intervals) {
    const count = Math.floor(seconds / threshold);
    if (count >= 1) {
      const unit = count === 1 ? singular : plural;
      return `${count} ${unit} ago`;
    }
  }

  return 'just now';
}

/**
 * Format a duration in milliseconds to a human-readable string.
 *
 * @param {number} ms - Duration in milliseconds.
 * @returns {string} Formatted duration (e.g. `"2h 15m"`, `"45s"`, `"0s"`).
 *
 * @example
 * formatDuration(8_100_000); // "2h 15m"
 * formatDuration(45_000);    // "45s"
 * formatDuration(90_061_000); // "1d 1h 1m"
 */
export function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds === 0) return '0s';

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  /** @type {string[]} */
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  // Only show seconds if there are no larger units, or if it's the only component
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);
  // Also show seconds alongside minutes for short durations (< 1 hour)
  if (seconds > 0 && parts.length > 0 && days === 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Format a number with its English ordinal suffix.
 *
 * @param {number} n - A positive integer.
 * @returns {string} Ordinal string (e.g. `1` → `"1st"`, `22` → `"22nd"`).
 *
 * @example
 * formatOrdinal(1);  // "1st"
 * formatOrdinal(2);  // "2nd"
 * formatOrdinal(3);  // "3rd"
 * formatOrdinal(11); // "11th"
 * formatOrdinal(21); // "21st"
 */
export function formatOrdinal(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);

  const abs = Math.abs(Math.floor(n));
  const lastTwo = abs % 100;
  const lastOne = abs % 10;

  /** @type {string} */
  let suffix;

  // 11th, 12th, 13th are special cases (not 1st, 2nd, 3rd)
  if (lastTwo >= 11 && lastTwo <= 13) {
    suffix = 'th';
  } else {
    switch (lastOne) {
      case 1: suffix = 'st'; break;
      case 2: suffix = 'nd'; break;
      case 3: suffix = 'rd'; break;
      default: suffix = 'th'; break;
    }
  }

  return `${Math.floor(n)}${suffix}`;
}
