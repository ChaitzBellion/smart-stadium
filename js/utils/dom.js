/** @module DOM */

/**
 * Create an HTML element safely with attributes, event listeners, and children.
 *
 * Attribute handling:
 * - `className`   → assigned to `el.className`
 * - `textContent` → assigned to `el.textContent`
 * - `innerHTML`   → **blocked** (XSS risk) — use children instead
 * - `dataset`     → merged via `Object.assign(el.dataset, val)`
 * - `style`       → if object, merged via `Object.assign(el.style, val)`;
 *                    if string, assigned to `el.style.cssText`
 * - `aria-*`      → set via `setAttribute`
 * - `data-*`      → set via `setAttribute`
 * - `on*` (e.g. `onClick`) → added via `addEventListener` (lowercased event name)
 * - Everything else → set via `setAttribute`
 *
 * @param {string} tag - HTML tag name (e.g. `'div'`, `'button'`).
 * @param {Object} [attrs={}] - Attributes, properties, and event handlers.
 * @param {Array<HTMLElement|string>} [children=[]] - Child elements or text strings.
 * @returns {HTMLElement} The constructed element.
 *
 * @example
 * const card = createElement('div', { className: 'card', dataset: { id: '42' } }, [
 *   createElement('h2', { textContent: 'Match Day' }),
 *   createElement('button', { onClick: () => alert('Clicked!'), textContent: 'Details' })
 * ]);
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      case 'className':
        el.className = value;
        break;

      case 'textContent':
        el.textContent = value;
        break;

      case 'innerHTML':
        // Intentionally blocked — use children or textContent
        console.warn('[DOM] innerHTML is blocked in createElement for security. Use children instead.');
        break;

      case 'dataset':
        if (typeof value === 'object') {
          Object.assign(el.dataset, value);
        }
        break;

      case 'style':
        if (typeof value === 'object') {
          Object.assign(el.style, value);
        } else if (typeof value === 'string') {
          el.style.cssText = value;
        }
        break;

      case 'htmlFor':
        el.setAttribute('for', value);
        break;

      case 'tabIndex':
        el.tabIndex = value;
        break;

      case 'disabled':
      case 'checked':
      case 'readOnly':
      case 'required':
      case 'autofocus':
        el[key] = Boolean(value);
        break;

      case 'value':
        el.value = value;
        break;

      default:
        // Event handlers: onClick → click, onKeyDown → keydown, etc.
        if (key.startsWith('on') && typeof value === 'function') {
          const eventName = key.slice(2).toLowerCase();
          el.addEventListener(eventName, value);
        }
        // aria-* and data-* attributes
        else if (key.startsWith('aria-') || key.startsWith('data-')) {
          el.setAttribute(key, value);
        }
        // ARIA shorthand: ariaLabel → aria-label, ariaHidden → aria-hidden
        else if (key.startsWith('aria') && key.length > 4) {
          const ariaAttr = 'aria-' + key.slice(4).toLowerCase();
          el.setAttribute(ariaAttr, value);
        }
        // role, id, type, placeholder, name, src, href, alt, title, etc.
        else {
          el.setAttribute(key, value);
        }
        break;
    }
  }

  // Append children
  for (const child of children) {
    if (child === null || child === undefined) continue;

    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Query-selector shorthand — returns the first matching element or `null`.
 *
 * @param {string} selector - CSS selector string.
 * @param {Element|Document} [parent=document] - Context element to search within.
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query-selector-all shorthand — returns a real Array of matching elements.
 *
 * @param {string} selector - CSS selector string.
 * @param {Element|Document} [parent=document] - Context element to search within.
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/**
 * Safely remove all child nodes from an element.
 *
 * Uses `replaceChildren()` (modern, single reflow) with a fallback
 * for older environments.
 *
 * @param {Element} el - The element to clear.
 */
export function clearElement(el) {
  if (!(el instanceof Element)) return;

  if (typeof el.replaceChildren === 'function') {
    el.replaceChildren();
  } else {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }
}

/**
 * Append multiple children to a parent element in a single call.
 *
 * Children can be `HTMLElement` instances or plain strings (which are
 * converted to text nodes).
 *
 * @param {Element} parent - The parent element.
 * @param {Array<Element|string>} children - Children to append.
 */
export function appendChildren(parent, children) {
  if (!(parent instanceof Element)) return;

  const fragment = document.createDocumentFragment();

  for (const child of children) {
    if (child === null || child === undefined) continue;

    if (typeof child === 'string') {
      fragment.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      fragment.appendChild(child);
    }
  }

  parent.appendChild(fragment);
}

/**
 * Set multiple attributes on an element in a single call.
 *
 * @param {Element} el - Target element.
 * @param {Record<string, string>} attrs - Key-value pairs to set.
 */
export function setAttributes(el, attrs) {
  if (!(el instanceof Element) || typeof attrs !== 'object') return;

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, value);
    }
  }
}

/**
 * Add a CSS animation class to an element and automatically remove it
 * after the animation completes.
 *
 * Listens for the `animationend` event first; if no animation fires
 * within `duration` ms, the class is removed via a fallback timer.
 *
 * @param {Element} el - The element to animate.
 * @param {string} animationClass - CSS class that triggers the animation.
 * @param {number} [duration=400] - Fallback timeout in milliseconds.
 * @returns {Promise<void>} Resolves when the animation class is removed.
 */
export function animateElement(el, animationClass, duration = 400) {
  if (!(el instanceof Element)) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      el.classList.remove(animationClass);
      el.removeEventListener('animationend', onEnd);
      resolve();
    };

    const onEnd = () => cleanup();

    el.addEventListener('animationend', onEnd, { once: true });
    el.classList.add(animationClass);

    // Fallback in case CSS animation doesn't fire
    setTimeout(cleanup, duration);
  });
}

/**
 * Announce a message to screen readers via an ARIA live region.
 *
 * Creates a visually-hidden live region on first call and reuses it.
 * The message is inserted, announced, then cleared after a short delay.
 *
 * @param {string} message - The announcement text.
 * @param {'polite'|'assertive'} [priority='polite'] - ARIA live priority.
 */
export function announceToScreenReader(message, priority = 'polite') {
  /** @type {HTMLElement|null} */
  let region = document.getElementById('sr-live-region');

  if (!region) {
    region = document.createElement('div');
    region.id = 'sr-live-region';
    region.setAttribute('role', 'status');
    // Visually hidden but accessible to screen readers
    Object.assign(region.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      padding: '0',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0'
    });
    document.body.appendChild(region);
  }

  region.setAttribute('aria-live', priority);

  // Clear first so that repeated identical messages still trigger announcements
  region.textContent = '';

  // Use rAF + microtask to guarantee the DOM update is picked up
  requestAnimationFrame(() => {
    region.textContent = message;
  });

  // Clean up after the screen reader has had time to read it
  setTimeout(() => {
    if (region) region.textContent = '';
  }, 3000);
}

/**
 * Create a debounced version of a function.
 *
 * The returned function delays invoking `fn` until `delay` ms have
 * elapsed since the last invocation. Useful for search inputs, resize
 * handlers, etc.
 *
 * @param {Function} fn - The function to debounce.
 * @param {number} [delay=300] - Debounce delay in milliseconds.
 * @returns {Function & { cancel: () => void }} Debounced function with a `cancel` method.
 *
 * @example
 * const search = debounce((query) => fetchResults(query), 250);
 * inputEl.addEventListener('input', (e) => search(e.target.value));
 */
export function debounce(fn, delay = 300) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timerId = null;

  /** @param {...*} args */
  const debounced = function (...args) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      fn.apply(this, args);
    }, delay);
  };

  /** Cancel a pending invocation. */
  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}

/**
 * Create a throttled version of a function.
 *
 * The returned function invokes `fn` at most once every `limit` ms.
 * Uses a trailing-edge strategy: if called while throttled, the last
 * call is queued and executed when the cooldown expires.
 *
 * @param {Function} fn - The function to throttle.
 * @param {number} [limit=100] - Minimum interval in milliseconds.
 * @returns {Function & { cancel: () => void }} Throttled function with a `cancel` method.
 *
 * @example
 * const onScroll = throttle(() => updateScrollPosition(), 100);
 * window.addEventListener('scroll', onScroll);
 */
export function throttle(fn, limit = 100) {
  /** @type {boolean} */
  let waiting = false;
  /** @type {Array|null} Queued args from the most recent call while throttled */
  let lastArgs = null;
  /** @type {*} */
  let lastThis = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timerId = null;

  const throttled = function (...args) {
    if (waiting) {
      // Queue the latest call
      lastArgs = args;
      lastThis = this;
      return;
    }

    fn.apply(this, args);
    waiting = true;

    timerId = setTimeout(() => {
      waiting = false;
      timerId = null;

      // Execute trailing call if one was queued
      if (lastArgs !== null) {
        throttled.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }, limit);
  };

  /** Cancel any pending trailing invocation. */
  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    waiting = false;
    lastArgs = null;
    lastThis = null;
  };

  return throttled;
}
