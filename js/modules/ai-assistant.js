/**
 * @fileoverview AI Assistant Module — GenAI-Powered Chat Interface
 *
 * The star feature of the FIFA World Cup 2026 Smart Stadium app.
 * Provides a conversational AI interface that helps fans with match schedules,
 * wayfinding, food recommendations, crowd information, and more.
 *
 * @module modules/ai-assistant
 */

import {
  createElement,
  $,
  $$,
  clearElement,
  appendChildren,
  debounce,
  announceToScreenReader,
} from '../utils/dom.js';
import { formatTime, formatDateTime, timeAgo } from '../utils/formatters.js';
import { EventBus } from '../services/event-bus.js';
import { StateManager } from '../services/state-manager.js';
import { Security } from '../services/security.js';
import { AIService } from '../services/ai-service.js';

/* ------------------------------------------------------------------ */
/*  Module-level State                                                */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Root container element provided by the host */
let _container = null;

/** @type {HTMLElement|null} Scrollable chat messages area */
let _messagesEl = null;

/** @type {HTMLElement|null} Typing indicator element */
let _typingIndicator = null;

/** @type {HTMLElement|null} Text input field */
let _inputEl = null;

/** @type {HTMLElement|null} Send button */
let _sendBtn = null;

/** @type {HTMLElement|null} Suggestion chips wrapper */
let _suggestionsEl = null;

/** @type {HTMLElement|null} The currently streaming AI bubble (if any) */
let _streamingBubble = null;

/** @type {boolean} Whether the AI is currently processing a response */
let _isProcessing = false;

/** @type {Function|null} Rate-limiter returned by Security.createRateLimiter */
let _rateLimiter = null;

/** @type {number} Timestamp of the last sent message (fallback rate-limit) */
let _lastSentTimestamp = 0;

/** @constant {number} Minimum milliseconds between sent messages */
const RATE_LIMIT_MS = 2000;

/** @type {string[]} Currently displayed suggestion strings */
let _currentSuggestions = [];

/** @type {Function[]} EventBus unsubscribe handles */
let _unsubscribers = [];

/** @constant {string} Welcome message shown on first load / after clearing */
const WELCOME_MESSAGE =
  '👋 Hello! I\'m your FIFA World Cup 2026 Smart Stadium Assistant. ' +
  'I can help you with match schedules, finding your way around, food ' +
  'recommendations, crowd information, and much more. How can I assist you today?';

/** @constant {string[]} Default suggestion chips */
const DEFAULT_SUGGESTIONS = [
  "What's the next match?",
  'Where can I find food nearby?',
  'How do I get to my seat?',
  'Show me crowd levels',
  'Nearest restroom',
  'Stadium Wi-Fi info',
];

/* ------------------------------------------------------------------ */
/*  Helper: Rate Limiting                                             */
/* ------------------------------------------------------------------ */

/**
 * Initialise or return the rate-limiter function.
 * Falls back to a simple timestamp check if Security.createRateLimiter
 * is unavailable.
 *
 * @returns {Function} A function that returns `true` if the action is allowed.
 */
function _getRateLimiter() {
  if (_rateLimiter) return _rateLimiter;

  if (typeof Security.createRateLimiter === 'function') {
    const limiter = Security.createRateLimiter(1, RATE_LIMIT_MS);
    _rateLimiter = () => {
      try {
        return limiter.check();
      } catch {
        return false;
      }
    };
  } else {
    // Fallback: simple timestamp-based limiter
    _rateLimiter = () => {
      const now = Date.now();
      if (now - _lastSentTimestamp < RATE_LIMIT_MS) return false;
      _lastSentTimestamp = now;
      return true;
    };
  }
  return _rateLimiter;
}

/* ------------------------------------------------------------------ */
/*  Helper: Scroll Management                                         */
/* ------------------------------------------------------------------ */

/**
 * Determines whether the chat area is scrolled to (or near) the bottom.
 *
 * @returns {boolean} `true` when the user is within 80 px of the bottom.
 */
function _isNearBottom() {
  if (!_messagesEl) return true;
  const { scrollTop, scrollHeight, clientHeight } = _messagesEl;
  return scrollHeight - scrollTop - clientHeight < 80;
}

/**
 * Scrolls the chat messages area to the very bottom, but only if the user
 * hasn't manually scrolled upward.
 *
 * @param {boolean} [force=false] If true, scrolls regardless of position.
 */
function _scrollToBottom(force = false) {
  if (!_messagesEl) return;
  if (force || _isNearBottom()) {
    _messagesEl.scrollTop = _messagesEl.scrollHeight;
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: DOM Builders                                              */
/* ------------------------------------------------------------------ */

/**
 * Creates a single chat bubble element.
 *
 * @param {'user'|'ai'} sender  Who sent the message.
 * @param {string}      text    The message body text.
 * @returns {HTMLElement} The `.chat-bubble` element.
 */
function _createBubble(sender, text) {
  const bubble = createElement('div', {
    className: `chat-bubble chat-bubble--${sender}`,
    role: 'article',
    'aria-label': sender === 'user' ? 'Your message' : 'Assistant message',
  });

  const timestamp = createElement('time', {
    className: 'text-muted',
  });
  timestamp.textContent = formatTime ? formatTime(new Date()) : new Date().toLocaleTimeString();
  timestamp.style.cssText = 'font-size:0.7rem;display:block;margin-top:4px;';

  // For AI messages we allow pre-escaped structured content
  if (sender === 'ai') {
    const content = createElement('div');
    content.innerHTML = Security.escapeHTML(text);
    bubble.appendChild(content);
  } else {
    const content = createElement('span');
    content.textContent = text;
    bubble.appendChild(content);
  }

  bubble.appendChild(timestamp);
  return bubble;
}

/**
 * Builds the typing indicator element with three bouncing dots.
 *
 * @returns {HTMLElement} The `.typing-indicator` element.
 */
function _buildTypingIndicator() {
  const wrapper = createElement('div', { className: 'typing-indicator' });
  wrapper.style.display = 'none';
  wrapper.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 3; i++) {
    const dot = createElement('span');
    dot.textContent = '·';
    wrapper.appendChild(dot);
  }
  return wrapper;
}

/**
 * Shows the typing indicator inside the messages area.
 */
function _showTyping() {
  if (_typingIndicator) {
    _typingIndicator.style.display = '';
    _typingIndicator.setAttribute('aria-hidden', 'false');
    _scrollToBottom();
  }
}

/**
 * Hides the typing indicator.
 */
function _hideTyping() {
  if (_typingIndicator) {
    _typingIndicator.style.display = 'none';
    _typingIndicator.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Renders suggestion chips into the suggestions container.
 *
 * @param {string[]} suggestions Array of suggestion strings.
 */
function _renderSuggestions(suggestions) {
  if (!_suggestionsEl) return;
  clearElement(_suggestionsEl);
  _currentSuggestions = suggestions || DEFAULT_SUGGESTIONS;

  _currentSuggestions.forEach((text, idx) => {
    const chip = createElement('button', {
      className: 'chip',
      type: 'button',
      'aria-label': `Suggested question: ${text}`,
    });
    chip.textContent = text;
    chip.style.setProperty('--delay', `${idx * 60}ms`);
    chip.classList.add('animate-in');
    chip.addEventListener('click', () => _handleSuggestionClick(text));
    _suggestionsEl.appendChild(chip);
  });
}

/* ------------------------------------------------------------------ */
/*  Core Actions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Handles sending a user message to the AI service.
 *
 * Flow:
 * 1. Validate & rate-limit
 * 2. Display user bubble instantly
 * 3. Show typing indicator
 * 4. Call AIService.sendMessage()
 * 5. Listen for streaming events
 * 6. Finalise AI bubble on completion
 *
 * @param {string} rawText The raw user input text.
 * @returns {Promise<void>}
 */
async function _sendMessage(rawText) {
  const text = rawText.trim();
  if (!text || _isProcessing) return;

  // Rate limit check
  const allowed = _getRateLimiter()();
  if (!allowed) {
    announceToScreenReader('Please wait a moment before sending another message.');
    return;
  }

  _isProcessing = true;
  _setInputState(false);

  // 1. Display user bubble immediately
  const userBubble = _createBubble('user', text);
  userBubble.classList.add('animate-in');
  _messagesEl.insertBefore(userBubble, _typingIndicator);
  _scrollToBottom(true);

  // 2. Clear input
  _inputEl.value = '';

  // 3. Show typing indicator
  _showTyping();

  // 4. Prepare streaming AI bubble
  _streamingBubble = createElement('div', {
    className: 'chat-bubble chat-bubble--ai',
    role: 'article',
    'aria-label': 'Assistant message',
  });
  _streamingBubble.classList.add('animate-in');
  const streamContent = createElement('span');
  _streamingBubble.appendChild(streamContent);
  // Don't add to DOM until first streaming chunk or final response

  try {
    const response = await AIService.sendMessage(text);

    // 5. Finalise AI bubble
    _hideTyping();

    // Remove streaming bubble if it was added during streaming
    if (_streamingBubble && _streamingBubble.parentNode) {
      _streamingBubble.parentNode.removeChild(_streamingBubble);
    }

    // Create final bubble with complete response
    const responseText =
      response && response.response ? response.response : 'I apologize, I could not process that request. Please try again.';
    const aiBubble = _createBubble('ai', responseText);
    aiBubble.classList.add('animate-in');
    _messagesEl.insertBefore(aiBubble, _typingIndicator);
    _scrollToBottom(true);

    // 6. Update suggestions
    if (response && response.suggestions && response.suggestions.length > 0) {
      _renderSuggestions(response.suggestions);
    } else {
      _renderSuggestions(DEFAULT_SUGGESTIONS);
    }

    // 7. Screen reader announcement
    announceToScreenReader('New response from assistant');
  } catch (err) {
    _hideTyping();

    // Show error bubble
    const errorBubble = _createBubble(
      'ai',
      '⚠️ Sorry, I encountered an error processing your request. Please try again.'
    );
    errorBubble.classList.add('animate-in');
    _messagesEl.insertBefore(errorBubble, _typingIndicator);
    _scrollToBottom(true);

    announceToScreenReader('Error: could not get response from assistant');
  } finally {
    _isProcessing = false;
    _streamingBubble = null;
    _setInputState(true);
    if (_inputEl) _inputEl.focus();
  }
}

/**
 * Enables or disables the chat input + send button.
 *
 * @param {boolean} enabled Whether to enable the controls.
 */
function _setInputState(enabled) {
  if (_inputEl) {
    _inputEl.disabled = !enabled;
    _inputEl.setAttribute('aria-disabled', String(!enabled));
  }
  if (_sendBtn) {
    _sendBtn.disabled = !enabled;
    _sendBtn.setAttribute('aria-disabled', String(!enabled));
  }
}

/**
 * Handles clicking a suggestion chip — sends that text as a message.
 *
 * @param {string} text The suggestion text.
 */
function _handleSuggestionClick(text) {
  if (_isProcessing) return;
  _sendMessage(text);
}

/**
 * Clears the entire chat conversation and resets the UI.
 */
function _clearChat() {
  AIService.clearHistory();

  // Remove all bubbles from messages area
  if (_messagesEl) {
    clearElement(_messagesEl);
    _typingIndicator = _buildTypingIndicator();
    _messagesEl.appendChild(_typingIndicator);

    // Re-add welcome message
    const welcomeBubble = _createBubble('ai', WELCOME_MESSAGE);
    welcomeBubble.classList.add('animate-in');
    _messagesEl.insertBefore(welcomeBubble, _typingIndicator);
  }

  _renderSuggestions(DEFAULT_SUGGESTIONS);
  _isProcessing = false;
  _streamingBubble = null;
  _setInputState(true);
  if (_inputEl) {
    _inputEl.value = '';
    _inputEl.focus();
  }

  announceToScreenReader('Chat conversation cleared');
}

/* ------------------------------------------------------------------ */
/*  EventBus Handlers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Handles the `ai:stream` event — streams characters into the AI bubble.
 *
 * @param {string|object} data The event payload, expected to be a string or an object with a `text` property.
 */
function _onAIStream(data) {
  if (!_streamingBubble || !_messagesEl) return;

  // Ensure streaming bubble is in the DOM
  if (!_streamingBubble.parentNode) {
    _hideTyping();
    _messagesEl.insertBefore(_streamingBubble, _typingIndicator);
  }

  const contentEl = _streamingBubble.firstChild;
  const text = typeof data === 'string' ? data : data && typeof data.text === 'string' ? data.text : '';
  if (contentEl && text) {
    contentEl.textContent = text;
  }
  _scrollToBottom();
}

/**
 * Handles the `ai:response` event — finalises the AI bubble.
 *
 * @param {object} data The full response payload.
 */
function _onAIResponse(data) {
  // This is handled in the _sendMessage try/catch for the promise flow,
  // but we keep this handler for any external EventBus-driven updates.
  if (data && data.suggestions && _suggestionsEl) {
    _renderSuggestions(data.suggestions);
  }
}

/* ------------------------------------------------------------------ */
/*  Build the Full UI                                                 */
/* ------------------------------------------------------------------ */

/**
 * Constructs the complete AI Assistant DOM tree.
 *
 * @returns {HTMLElement} Root element for the module.
 */
function _buildUI() {
  const root = createElement('div', {
    className: 'content-section',
  });
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;';

  /* ---- Page Header ---- */
  const header = createElement('div', { className: 'page-header' });
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = '🤖 AI Assistant';

  const clearBtn = createElement('button', {
    className: 'btn btn--ghost',
    type: 'button',
    'aria-label': 'Clear chat conversation',
  });
  clearBtn.textContent = '🗑️ Clear Chat';
  clearBtn.addEventListener('click', _clearChat);

  appendChildren(header, [title, clearBtn]);

  /* ---- Chat Container ---- */
  const chatContainer = createElement('div', { className: 'chat-container' });
  chatContainer.style.cssText =
    'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';

  /* ---- Messages Area ---- */
  _messagesEl = createElement('div', {
    className: 'chat-messages',
    role: 'log',
    'aria-live': 'polite',
    'aria-label': 'Chat conversation',
  });
  _messagesEl.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';

  // Typing indicator
  _typingIndicator = _buildTypingIndicator();
  _messagesEl.appendChild(_typingIndicator);

  // Welcome message
  const welcomeBubble = _createBubble('ai', WELCOME_MESSAGE);
  welcomeBubble.classList.add('animate-in');
  _messagesEl.insertBefore(welcomeBubble, _typingIndicator);

  /* ---- Suggestions ---- */
  _suggestionsEl = createElement('div', { className: 'chat-suggestions' });
  _suggestionsEl.style.cssText = 'flex-shrink:0;';
  _renderSuggestions(DEFAULT_SUGGESTIONS);

  /* ---- Input Area ---- */
  const inputArea = createElement('div', { className: 'chat-input-area' });
  inputArea.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:8px;';

  _inputEl = createElement('input', {
    type: 'text',
    placeholder: 'Ask me anything about the World Cup...',
    maxLength: 500,
    'aria-label': 'Type your message',
    className: 'search-input',
  });
  _inputEl.style.cssText = 'flex:1;';

  _inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _sendMessage(_inputEl.value);
    }
  });

  _sendBtn = createElement('button', {
    className: 'btn btn--primary',
    type: 'button',
    'aria-label': 'Send message',
  });
  _sendBtn.style.cssText =
    'width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0;font-size:1.1rem;flex-shrink:0;';
  _sendBtn.textContent = '➤';
  _sendBtn.addEventListener('click', () => _sendMessage(_inputEl.value));

  appendChildren(inputArea, [_inputEl, _sendBtn]);
  appendChildren(chatContainer, [_messagesEl, _suggestionsEl, inputArea]);
  appendChildren(root, [header, chatContainer]);

  return root;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialises the AI Assistant module and renders it into the given container.
 *
 * @param {HTMLElement} container The DOM element to render into.
 */
export function init(container) {
  _container = container;
  clearElement(_container);

  // Build & mount the UI
  const ui = _buildUI();
  _container.appendChild(ui);

  // Subscribe to EventBus events
  const unsubStream = EventBus.on
    ? EventBus.on('ai:stream', _onAIStream)
    : EventBus.subscribe
      ? EventBus.subscribe('ai:stream', _onAIStream)
      : null;
  const unsubResponse = EventBus.on
    ? EventBus.on('ai:response', _onAIResponse)
    : EventBus.subscribe
      ? EventBus.subscribe('ai:response', _onAIResponse)
      : null;
 
  if (typeof unsubStream === 'function') _unsubscribers.push(unsubStream);
  if (typeof unsubResponse === 'function') _unsubscribers.push(unsubResponse);

  // Restore previous conversation if any
  const history = AIService.getHistory();
  if (history && history.length > 0) {
    history.forEach((msg) => {
      const sender = msg.role === 'user' ? 'user' : 'ai';
      const bubble = _createBubble(sender, msg.content || msg.text || '');
      _messagesEl.insertBefore(bubble, _typingIndicator);
    });
    _scrollToBottom(true);
  }

  // Focus the input on load
  if (_inputEl) _inputEl.focus();
}

/**
 * Destroys the AI Assistant module, cleaning up all event listeners,
 * subscriptions, and DOM references.
 */
export function destroy() {
  // Unsubscribe from EventBus events
  _unsubscribers.forEach((unsub) => {
    if (typeof unsub === 'function') unsub();
  });
  _unsubscribers = [];

  // Clear DOM
  if (_container) {
    clearElement(_container);
  }

  // Reset module state
  _container = null;
  _messagesEl = null;
  _typingIndicator = null;
  _inputEl = null;
  _sendBtn = null;
  _suggestionsEl = null;
  _streamingBubble = null;
  _isProcessing = false;
  _rateLimiter = null;
  _lastSentTimestamp = 0;
  _currentSuggestions = [];
}
