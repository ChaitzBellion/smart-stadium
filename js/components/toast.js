/** @module Toast */

import { createElement } from '../utils/dom.js';

/**
 * @typedef {Object} ToastOptions
 * @property {string} message - The notification message text.
 * @property {'info'|'success'|'warning'|'error'} [type='info'] - Severity level.
 * @property {number} [duration=4000] - Auto-dismiss delay in milliseconds. Use `0` to disable.
 * @property {string} [title] - Optional bold title above the message.
 * @property {boolean} [dismissible=true] - Whether the user can manually dismiss the toast.
 */

/**
 * Unicode icons for each toast type.
 * @type {Record<string, string>}
 */
const ICONS = Object.freeze({
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌'
});

/**
 * ARIA role for each toast type.
 * Errors and warnings use 'alert' for assertive announcement;
 * info and success use 'status' for polite announcement.
 * @type {Record<string, string>}
 */
const ARIA_ROLES = Object.freeze({
  info: 'status',
  success: 'status',
  warning: 'alert',
  error: 'alert'
});

/**
 * ID of the toast container element.
 * @type {string}
 */
const CONTAINER_ID = 'toast-container';

/**
 * Default animation durations (ms).
 */
const ANIMATION_IN_DURATION = 300;
const ANIMATION_OUT_DURATION = 250;

/**
 * Get or create the fixed-position container that holds all toast elements.
 * Placed at the top-right of the viewport.
 *
 * @returns {HTMLElement} The toast container element.
 * @private
 */
function getContainer() {
  let container = document.getElementById(CONTAINER_ID);

  if (!container) {
    container = createElement('div', {
      id: CONTAINER_ID,
      className: 'toast-container',
      'aria-live': 'polite',
      'aria-relevant': 'additions',
      style: {
        position: 'fixed',
        top: '16px',
        right: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: '10000',
        pointerEvents: 'none',
        maxHeight: '100vh',
        overflow: 'visible'
      }
    });
    document.body.appendChild(container);
  }

  return container;
}

/**
 * Build and return a single toast element.
 *
 * @param {ToastOptions} options - Toast configuration.
 * @returns {{ element: HTMLElement, dismiss: () => void }} The toast element and its dismiss fn.
 * @private
 */
function createToast(options) {
  const { message, type = 'info', title, dismissible = true } = options;

  const icon = ICONS[type] || ICONS.info;
  const role = ARIA_ROLES[type] || 'status';

  // ---- Icon ----
  const iconEl = createElement('span', {
    className: 'toast-icon',
    textContent: icon,
    'aria-hidden': 'true',
    style: { fontSize: '1.25rem', flexShrink: '0' }
  });

  // ---- Text content ----
  const textChildren = [];
  if (title) {
    textChildren.push(
      createElement('strong', {
        className: 'toast-title',
        textContent: title,
        style: { display: 'block', marginBottom: '2px' }
      })
    );
  }
  textChildren.push(
    createElement('span', {
      className: 'toast-message',
      textContent: message
    })
  );

  const textEl = createElement('div', { className: 'toast-text', style: { flex: '1' } }, textChildren);

  // ---- Toast wrapper ----
  const toastChildren = [iconEl, textEl];

  /** @type {ReturnType<typeof setTimeout>|null} */
  let dismissTimer = null;
  let dismissed = false;

  /**
   * Remove this toast with a fade-out animation.
   */
  function dismiss() {
    if (dismissed) return;
    dismissed = true;

    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    // Animate out
    Object.assign(toastEl.style, {
      opacity: '0',
      transform: 'translateX(100%)',
      transition: `opacity ${ANIMATION_OUT_DURATION}ms ease, transform ${ANIMATION_OUT_DURATION}ms ease`
    });

    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, ANIMATION_OUT_DURATION);
  }

  // ---- Close button ----
  if (dismissible) {
    const closeBtn = createElement('button', {
      className: 'toast-close',
      type: 'button',
      'aria-label': 'Dismiss notification',
      textContent: '✕',
      onClick: dismiss,
      style: {
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: '2px 6px',
        fontSize: '0.875rem',
        opacity: '0.7',
        flexShrink: '0',
        lineHeight: '1'
      }
    });
    toastChildren.push(closeBtn);
  }

  const toastEl = createElement('div', {
    className: `toast toast-${type}`,
    role,
    'aria-live': type === 'error' || type === 'warning' ? 'assertive' : 'polite',
    'aria-atomic': 'true',
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'auto',
      minWidth: '300px',
      maxWidth: '420px',
      fontSize: '0.875rem',
      lineHeight: '1.4',
      // Start off-screen for slide-in animation
      opacity: '0',
      transform: 'translateX(100%)',
      transition: `opacity ${ANIMATION_IN_DURATION}ms ease, transform ${ANIMATION_IN_DURATION}ms ease`,
      // Type-specific background colors (dark theme friendly)
      backgroundColor: getBackgroundColor(type),
      color: '#f0f0f0',
      borderLeft: `4px solid ${getBorderColor(type)}`
    }
  }, toastChildren);

  // Store dismiss function on the element for dismissAll
  /** @type {*} */ (toastEl)._dismiss = dismiss;

  return { element: toastEl, dismiss };
}

/**
 * Get background color for a toast type.
 * @param {string} type
 * @returns {string}
 * @private
 */
function getBackgroundColor(type) {
  switch (type) {
    case 'success': return '#1a3a2a';
    case 'warning': return '#3a3520';
    case 'error':   return '#3a1a1a';
    case 'info':
    default:        return '#1a2a3a';
  }
}

/**
 * Get border accent color for a toast type.
 * @param {string} type
 * @returns {string}
 * @private
 */
function getBorderColor(type) {
  switch (type) {
    case 'success': return '#22c55e';
    case 'warning': return '#eab308';
    case 'error':   return '#ef4444';
    case 'info':
    default:        return '#3b82f6';
  }
}

/**
 * Toast notification system for the Smart Stadium application.
 *
 * Toasts stack vertically in the top-right corner and auto-dismiss
 * after a configurable duration. They are announced to screen readers
 * via ARIA live regions.
 *
 * @example
 * import { Toast } from './toast.js';
 *
 * Toast.success('Ticket purchased successfully!');
 * Toast.error('Connection lost. Retrying…', 6000);
 * Toast.show({
 *   title: 'Goal!',
 *   message: 'Brazil scores in the 34th minute!',
 *   type: 'info',
 *   duration: 5000
 * });
 */
export const Toast = Object.freeze({
  /**
   * Show a toast notification with full options.
   *
   * @param {ToastOptions} options - Toast configuration.
   * @returns {{ dismiss: () => void }} Handle to programmatically dismiss the toast.
   */
  show(options) {
    if (!options || typeof options.message !== 'string' || options.message.trim().length === 0) {
      console.warn('[Toast] show() requires a non-empty "message" string.');
      return { dismiss: () => {} };
    }

    const container = getContainer();
    const { element, dismiss } = createToast(options);

    container.appendChild(element);

    // Trigger slide-in animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateX(0)';
      });
    });

    // Auto-dismiss
    const duration = options.duration ?? 4000;
    if (duration > 0) {
      const timerId = setTimeout(dismiss, duration);
      // Store timer ID so dismiss() can clear it
      /** @type {*} */ (element)._timerId = timerId;
    }

    return { dismiss };
  },

  /**
   * Show an **info** toast.
   *
   * @param {string} message - Notification text.
   * @param {number} [duration=4000] - Auto-dismiss delay in ms.
   * @returns {{ dismiss: () => void }}
   */
  info(message, duration) {
    return this.show({ message, type: 'info', duration });
  },

  /**
   * Show a **success** toast.
   *
   * @param {string} message - Notification text.
   * @param {number} [duration=4000] - Auto-dismiss delay in ms.
   * @returns {{ dismiss: () => void }}
   */
  success(message, duration) {
    return this.show({ message, type: 'success', duration });
  },

  /**
   * Show a **warning** toast.
   *
   * @param {string} message - Notification text.
   * @param {number} [duration=5000] - Auto-dismiss delay in ms.
   * @returns {{ dismiss: () => void }}
   */
  warning(message, duration = 5000) {
    return this.show({ message, type: 'warning', duration });
  },

  /**
   * Show an **error** toast.
   *
   * @param {string} message - Notification text.
   * @param {number} [duration=6000] - Auto-dismiss delay in ms (longer for errors).
   * @returns {{ dismiss: () => void }}
   */
  error(message, duration = 6000) {
    return this.show({ message, type: 'error', duration });
  },

  /**
   * Dismiss all visible toasts immediately.
   */
  dismissAll() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    const toasts = [...container.children];
    for (const toast of toasts) {
      const dismissFn = /** @type {*} */ (toast)._dismiss;
      if (typeof dismissFn === 'function') {
        dismissFn();
      } else if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }
  }
});
