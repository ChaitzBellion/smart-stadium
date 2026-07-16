import { EventBus } from './services/event-bus.js';
import { StateManager } from './services/state-manager.js';
import { DataService } from './services/data-service.js';
import { Security } from './services/security.js';
import { Toast } from './components/toast.js';

import * as dashboardModule from './modules/dashboard.js';
import * as matchCenterModule from './modules/match-center.js';
import * as crowdAnalyticsModule from './modules/crowd-analytics.js';
import * as venueOpsModule from './modules/venue-ops.js';
import * as fanExperienceModule from './modules/fan-experience.js';
import * as aiAssistantModule from './modules/ai-assistant.js';

const modules = {
  'dashboard': dashboardModule,
  'match-center': matchCenterModule,
  'crowd-analytics': crowdAnalyticsModule,
  'venue-ops': venueOpsModule,
  'fan-experience': fanExperienceModule,
  'ai-assistant': aiAssistantModule
};

let currentModule = null;

function initApp() {
  // Initialize state
  StateManager.setState('ui', { currentPage: 'dashboard', sidebarOpen: false, theme: 'dark' });
  
  // Setup navigation
  setupNavigation();
  
  // Setup global event listeners
  setupGlobalEvents();
  
  // Start simulation engine
  DataService.startLiveSimulation();
  
  // Load initial module
  loadModule('dashboard');
  
  // Welcome toast
  setTimeout(() => {
    Toast.info('Welcome to FIFA World Cup 2026 Smart Stadium Ops', 5000);
  }, 1000);
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      if (page) {
        // Update UI
        navItems.forEach(nav => nav.classList.remove('nav-item--active'));
        item.classList.add('nav-item--active');
        
        // Close sidebar on mobile
        if (window.innerWidth < 1024) {
          sidebar.classList.remove('sidebar--open');
        }
        
        loadModule(page);
      }
    });
  });
  
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar--open');
    });
  }
}

function setupGlobalEvents() {
  EventBus.on('alert:new', (alert) => {
    if (alert.severity === 'critical') {
      Toast.error(`CRITICAL: ${alert.title}`, 8000);
    } else if (alert.severity === 'warning') {
      Toast.warning(alert.title, 5000);
    }
  });
}

function loadModule(pageName) {
  const module = modules[pageName];
  if (!module) {
    console.error(`Module ${pageName} not found`);
    return;
  }
  
  const container = document.getElementById('main-content-area');
  
  if (currentModule && currentModule.destroy) {
    currentModule.destroy();
  }
  
  container.innerHTML = '';
  container.className = `module-container module-${pageName} animate-in`;
  
  try {
    module.init(container);
    currentModule = module;
    StateManager.setState('ui', { currentPage: pageName });
    EventBus.emit('navigation:change', pageName);
  } catch (e) {
    console.error(`Error loading module ${pageName}:`, e);
    container.innerHTML = `<div class="empty-state">
      <div class="text-error" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h3 class="page-title text-error">Module Load Error</h3>
      <p class="text-secondary">There was a problem loading the ${pageName} module.</p>
    </div>`;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
