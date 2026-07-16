/** @module Modal */

import { createElement } from '../utils/dom.js';

/**
 * @typedef {Object} ModalAction
 * @property {string} text - Button label.
 * @property {string} [variant='secondary'] - CSS variant class ('primary', 'secondary', 'danger', 'ghost').
 * @property {Function} onClick - Click handler. Receives the Modal instance as its argument.
 */

/**
 * @typedef {Object} ModalOptions
 * @property {string} title - Dialog title (displayed in the header).
 * @property {string|HTMLElement} content - Body content — string (inserted as text) or DOM element.
 * @property {'sm'|'md'|'lg'} [size='md'] - Container width preset.
 * @property {Function} [onClose] - Callback invoked when the modal is closed (for any reason).
 * @property {ModalAction[]} [actions=[]] - Footer action buttons.
 * @property {boolean} [closeOnBackdrop=true] - Whether clicking the backdrop closes the modal.
 * @property {boolean} [closeOnEscape=true] - Whether pressing Escape closes the modal.
 */

/**
 * Maximum width for each size preset.
 * @type {Record<string, string>}
 */
const SIZE_MAP = Object.freeze({
  sm: '400px',
  md: '600px',
  lg: '900px'
});

/**
 * Selector for elements that can receive focus inside the modal.
 * @type {string}
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Accessible modal dialog component.
 *
 * Features:
 * - **Focus trap** — Tab / Shift+Tab cycles within the modal
 * - **Escape to close** — configurable via `closeOnEscape`
 * - **Backdrop click to close** — configurable via `closeOnBackdrop`
 * - **ARIA attributes** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
 * - **Focus restoration** — focus returns to the trigger element on close
 *
 * @example
 * const modal = new Modal({
 *   title: 'Match Details',
 *   content: detailsElement,
 *   size: 'lg',
 *   actions: [
 *     { text: 'Close', variant: 'secondary', onClick: (m) => m.close() },
 *     { text: 'Buy Tickets', variant: 'primary', onClick: () => buyTickets() }
 *   ],
 *   onClose: () => console.log('Modal closed')
 * });
 * modal.open();
 */
export class Modal {
  /** @type {ModalOptions} */
  #options;

  /** @type {HTMLElement|null} Overlay element (backdrop + container) */
  #overlay = null;

  /** @type {HTMLElement|null} The modal container itself */
  #container = null;

  /** @type {HTMLElement|null} Element that had focus before the modal opened */
  #previousFocus = null;

  /** @type {boolean} Whether the modal is currently visible */
  #isOpen = false;

  /** @type {((e: KeyboardEvent) => void)|null} Bound keydown handler for cleanup */
  #keydownHandler = null;

  /** @type {string} Unique ID for aria-labelledby */
  #titleId;

  /**
   * Create a new Modal instance.
   *
   * @param {ModalOptions} options - Configuration for the modal.
   */
  constructor(options) {
    this.#options = {
      size: 'md',
      actions: [],
      closeOnBackdrop: true,
      closeOnEscape: true,
      ...options
    };

    this.#titleId = `modal-title-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build the modal DOM tree.
   * @private
   */
  #build() {
    const { title, content, size, actions, closeOnBackdrop } = this.#options;

    // ---- Close button (×) ----
    const closeBtn = createElement('button', {
      className: 'modal-close',
      type: 'button',
      'aria-label': 'Close dialog',
      textContent: '✕',
      onClick: () => this.close()
    });

    // ---- Header ----
    const header = createElement('div', { className: 'modal-header' }, [
      createElement('h2', { id: this.#titleId, className: 'modal-title', textContent: title }),
      closeBtn
    ]);

    // ---- Body ----
    const body = createElement('div', { className: 'modal-body' });
    if (typeof content === 'string') {
      body.textContent = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }

    // ---- Footer (only if there are actions) ----
    /** @type {HTMLElement|null} */
    let footer = null;
    if (actions.length > 0) {
      const buttons = actions.map((action) =>
        createElement('button', {
          className: `btn btn-${action.variant || 'secondary'}`,
          type: 'button',
          textContent: action.text,
          onClick: () => {
            if (typeof action.onClick === 'function') {
              action.onClick(this);
            }
          }
        })
      );
      footer = createElement('div', { className: 'modal-footer' }, buttons);
    }

    // ---- Container ----
    const containerChildren = [header, body];
    if (footer) containerChildren.push(footer);

    this.#container = createElement(
      'div',
      {
        className: 'modal-container',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': this.#titleId,
        style: { maxWidth: SIZE_MAP[size] || SIZE_MAP.md }
      },
      containerChildren
    );

    // Prevent clicks inside the container from closing the modal
    this.#container.addEventListener('click', (e) => e.stopPropagation());

    // ---- Overlay ----
    this.#overlay = createElement('div', { className: 'modal-overlay' }, [this.#container]);

    if (closeOnBackdrop) {
      this.#overlay.addEventListener('click', () => this.close());
    }
  }

  /**
   * Open the modal — build DOM, trap focus, attach keyboard listener.
   */
  open() {
    if (this.#isOpen) return;

    // Remember the currently focused element for restoration
    this.#previousFocus = /** @type {HTMLElement|null} */ (document.activeElement);

    this.#build();
    document.body.appendChild(this.#overlay);
    this.#isOpen = true;

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    // Set up keyboard handling (Escape + focus trap)
    this.#keydownHandler = (e) => this.#handleKeydown(e);
    document.addEventListener('keydown', this.#keydownHandler);

    // Focus the first focusable element (or the container itself)
    requestAnimationFrame(() => {
      const firstFocusable = this.#container?.querySelector(FOCUSABLE_SELECTOR);
      if (firstFocusable) {
        /** @type {HTMLElement} */ (firstFocusable).focus();
      } else {
        this.#container?.setAttribute('tabindex', '-1');
        this.#container?.focus();
      }
    });
  }

  /**
   * Close the modal — remove from DOM, restore focus, fire onClose callback.
   */
  close() {
    if (!this.#isOpen) return;
    this.#isOpen = false;

    // Remove keyboard listener
    if (this.#keydownHandler) {
      document.removeEventListener('keydown', this.#keydownHandler);
      this.#keydownHandler = null;
    }

    // Remove overlay from DOM
    if (this.#overlay && this.#overlay.parentNode) {
      this.#overlay.parentNode.removeChild(this.#overlay);
    }

    // Restore background scrolling
    document.body.style.overflow = '';

    // Restore focus to the trigger element
    if (this.#previousFocus && typeof this.#previousFocus.focus === 'function') {
      this.#previousFocus.focus();
    }
    this.#previousFocus = null;

    // Fire the onClose callback
    if (typeof this.#options.onClose === 'function') {
      try {
        this.#options.onClose();
      } catch (err) {
        console.error('[Modal] Error in onClose callback:', err);
      }
    }
  }

  /**
   * Fully destroy the modal — close it and null out all references.
   * After calling `destroy()`, the instance should not be reused.
   */
  destroy() {
    this.close();
    this.#overlay = null;
    this.#container = null;
    this.#options = /** @type {*} */ (null);
  }

  /**
   * Whether the modal is currently open.
   * @returns {boolean}
   */
  get isOpen() {
    return this.#isOpen;
  }

  /**
   * Handle keydown events for Escape-to-close and focus trapping.
   *
   * @param {KeyboardEvent} e
   * @private
   */
  #handleKeydown(e) {
    // Escape to close
    if (e.key === 'Escape' && this.#options.closeOnEscape) {
      e.preventDefault();
      this.close();
      return;
    }

    // Focus trap on Tab / Shift+Tab
    if (e.key === 'Tab') {
      this.#trapFocus(e);
    }
  }

  /**
   * Trap Tab focus within the modal container.
   *
   * @param {KeyboardEvent} e
   * @private
   */
  #trapFocus(e) {
    if (!this.#container) return;

    const focusableElements = /** @type {HTMLElement[]} */ (
      [...this.#container.querySelectorAll(FOCUSABLE_SELECTOR)]
    );

    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
