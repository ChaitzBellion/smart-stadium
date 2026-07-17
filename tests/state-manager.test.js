import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../js/services/state-manager.js';

describe('StateManager', () => {
  beforeEach(() => {
    StateManager.resetState();
  });

  it('returns a deep clone from getState', () => {
    StateManager.setState('ui', { sidebarOpen: true });
    const uiState = StateManager.getState('ui');
    uiState.sidebarOpen = false;
    expect(StateManager.getState('ui').sidebarOpen).toBe(true);
  });

  it('notifies subscribers when slice state changes', () => {
    let received = null;
    StateManager.subscribe('ui', (value) => {
      received = value;
    });
    StateManager.setState('ui', { sidebarOpen: true });
    expect(received.sidebarOpen).toBe(true);
  });

  it('resets state to initial defaults', () => {
    StateManager.setState('ui', { currentPage: 'fan-experience' });
    StateManager.resetState('ui');
    expect(StateManager.getState('ui').currentPage).toBe('dashboard');
  });
});
