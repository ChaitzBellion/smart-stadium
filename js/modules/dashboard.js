/**
 * @module dashboard
 * @description Real-time Operations Dashboard — the main overview page for the
 * Smart Stadium FIFA World Cup 2026 application. Displays KPIs, live matches,
 * crowd density, recent alerts, and venue status at a glance.
 *
 * @requires ../utils/dom.js
 * @requires ../utils/formatters.js
 * @requires ../services/event-bus.js
 * @requires ../services/state-manager.js
 * @requires ../services/data-service.js
 * @requires ../services/security.js
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
import {
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatTime,
  formatDateTime,
  timeAgo,
} from '../utils/formatters.js';
import { EventBus } from '../services/event-bus.js';
import { StateManager } from '../services/state-manager.js';
import { DataService } from '../services/data-service.js';
import { Security } from '../services/security.js';

/* ──────────────────────────────────────────────
   Module-level state & references
   ────────────────────────────────────────────── */

/** @type {HTMLElement|null} Root container the module renders into */
let _container = null;

/** @type {number|null} Interval id for the header clock */
let _clockInterval = null;

/** @type {number|null} Interval id for simulated data refresh */
let _dataRefreshInterval = null;

/** @type {Function[]} EventBus unsubscribe callbacks */
const _subscriptions = [];

/** @type {Map<string, number>} Active counting-animation frame ids keyed by element id */
const _animationFrames = new Map();

/** @type {Object} Cached KPI values for counting animations */
let _kpiCache = {
  attendance: 0,
  activeVenues: 0,
  securityAlerts: 0,
  fanSatisfaction: 0,
};

/* ──────────────────────────────────────────────
   Simulated data generators
   ────────────────────────────────────────────── */

/**
 * Generates simulated live-match data.
 * @returns {Array<Object>} Array of match objects
 */
function _getLiveMatches() {
  return [
    {
      id: 'm1',
      homeTeam: '🇧🇷 Brazil',
      awayTeam: '🇩🇪 Germany',
      homeScore: 2,
      awayScore: 1,
      minute: 67,
      venue: 'MetLife Stadium',
      status: 'live',
    },
    {
      id: 'm2',
      homeTeam: '🇦🇷 Argentina',
      awayTeam: '🇫🇷 France',
      homeScore: 1,
      awayScore: 1,
      minute: 34,
      venue: 'AT&T Stadium',
      status: 'live',
    },
    {
      id: 'm3',
      homeTeam: '🇪🇸 Spain',
      awayTeam: '🇳🇱 Netherlands',
      homeScore: 0,
      awayScore: 0,
      minute: 12,
      venue: 'SoFi Stadium',
      status: 'live',
    },
  ];
}

/**
 * Generates simulated venue crowd-density data.
 * @returns {Array<Object>} Venue density objects sorted by percentage desc
 */
function _getVenueDensities() {
  const venues = [
    { name: 'MetLife Stadium', city: 'New York/New Jersey', capacity: 82500, current: 78200, status: 'operational' },
    { name: 'AT&T Stadium', city: 'Dallas', capacity: 80000, current: 71500, status: 'operational' },
    { name: 'SoFi Stadium', city: 'Los Angeles', capacity: 70240, current: 62100, status: 'warning' },
    { name: 'Hard Rock Stadium', city: 'Miami', capacity: 65326, current: 42800, status: 'operational' },
    { name: 'Lumen Field', city: 'Seattle', capacity: 69000, current: 58300, status: 'operational' },
    { name: 'NRG Stadium', city: 'Houston', capacity: 72220, current: 38900, status: 'operational' },
    { name: 'Lincoln Financial Field', city: 'Philadelphia', capacity: 69176, current: 59800, status: 'issue' },
    { name: 'Arrowhead Stadium', city: 'Kansas City', capacity: 76416, current: 45100, status: 'operational' },
    { name: 'BMO Field', city: 'Toronto', capacity: 45500, current: 41200, status: 'operational' },
    { name: 'Estadio Azteca', city: 'Mexico City', capacity: 87523, current: 81400, status: 'operational' },
    { name: 'Estadio BBVA', city: 'Monterrey', capacity: 53500, current: 28300, status: 'operational' },
    { name: 'Estadio Akron', city: 'Guadalajara', capacity: 49850, current: 35700, status: 'warning' },
  ];
  return venues
    .map((v) => ({ ...v, percentage: Math.round((v.current / v.capacity) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Generates simulated alert data.
 * @returns {Array<Object>} Alert objects
 */
function _getAlerts() {
  const now = Date.now();
  return [
    { id: 'a1', severity: 'critical', title: 'Overcrowding Risk — Zone B', message: 'Zone B at MetLife Stadium has exceeded 92% capacity. Immediate crowd control measures recommended.', timestamp: now - 120000, acknowledged: false },
    { id: 'a2', severity: 'warning', title: 'Gate 3 Queue Backup', message: 'AT&T Stadium Gate 3 experiencing 25-minute wait times. Consider opening auxiliary lanes.', timestamp: now - 300000, acknowledged: false },
    { id: 'a3', severity: 'info', title: 'VIP Section Secured', message: 'SoFi Stadium VIP Zone perimeter check completed successfully.', timestamp: now - 600000, acknowledged: true },
    { id: 'a4', severity: 'warning', title: 'Weather Advisory', message: 'Thunderstorm approaching Hard Rock Stadium. ETA 45 minutes. Activation of covered area protocol advised.', timestamp: now - 900000, acknowledged: false },
    { id: 'a5', severity: 'critical', title: 'Medical Emergency — Section 214', message: 'Medical team dispatched to Section 214, MetLife Stadium. Area being cleared.', timestamp: now - 1200000, acknowledged: true },
    { id: 'a6', severity: 'info', title: 'Concession Restock Complete', message: 'All concession stands at AT&T Stadium restocked for second half.', timestamp: now - 1800000, acknowledged: true },
    { id: 'a7', severity: 'warning', title: 'Parking Lot A Near Capacity', message: 'SoFi Stadium Parking Lot A at 94%. Redirect incoming traffic to Lot C.', timestamp: now - 2700000, acknowledged: false },
    { id: 'a8', severity: 'info', title: 'Broadcast Systems Normal', message: 'All venue broadcast systems operating within normal parameters.', timestamp: now - 3600000, acknowledged: true },
  ];
}

/* ──────────────────────────────────────────────
   KPI counting animation
   ────────────────────────────────────────────── */

/**
 * Animates a numeric value change on a KPI element using requestAnimationFrame.
 * @param {string} elementId - DOM id of the value element
 * @param {number} start - Starting value
 * @param {number} end - Target value
 * @param {number} duration - Animation duration in ms
 * @param {Function} formatter - Formatting function for display
 */
function _animateValue(elementId, start, end, duration, formatter) {
  // Cancel any running animation for this element
  if (_animationFrames.has(elementId)) {
    cancelAnimationFrame(_animationFrames.get(elementId));
  }

  const el = $(elementId);
  if (!el) return;

  const startTime = performance.now();
  const diff = end - start;

  /**
   * Animation step
   * @param {number} currentTime - Current timestamp from rAF
   */
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + diff * eased;
    el.textContent = formatter(Math.round(current));

    if (progress < 1) {
      _animationFrames.set(elementId, requestAnimationFrame(step));
    } else {
      _animationFrames.delete(elementId);
    }
  }

  _animationFrames.set(elementId, requestAnimationFrame(step));
}

/* ──────────────────────────────────────────────
   Section builders
   ────────────────────────────────────────────── */

/**
 * Builds the page header with title and auto-updating clock.
 * @returns {HTMLElement} The header element
 */
function _buildHeader() {
  const header = createElement('header', { className: 'page-header' });

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = 'Operations Dashboard';

  const clockEl = createElement('time', { id: 'dashboard-clock', className: 'text-secondary' });
  clockEl.textContent = formatDateTime(new Date());

  appendChildren(header, [title, clockEl]);

  // Update clock every second
  _clockInterval = setInterval(() => {
    const clock = $('#dashboard-clock');
    if (clock) {
      clock.textContent = formatDateTime(new Date());
    }
  }, 1000);

  return header;
}

/**
 * Builds a single KPI card.
 * @param {Object} config - KPI configuration
 * @param {string} config.id - Unique element id
 * @param {string} config.icon - Emoji icon
 * @param {string} config.label - KPI label
 * @param {string|number} config.value - Display value
 * @param {string} [config.trend] - Trend indicator (e.g. "+5.2%")
 * @param {string} [config.trendDirection] - "up" | "down" | "neutral"
 * @param {string} [config.colorClass] - Additional CSS class for coloring
 * @returns {HTMLElement} The KPI card element
 */
function _buildKpiCard({ id, icon, label, value, trend, trendDirection, colorClass }) {
  const card = createElement('div', { className: 'kpi-card animate-in' });
  card.style.setProperty('--delay', '0s');

  const iconEl = createElement('span', { className: 'kpi-icon' });
  iconEl.textContent = icon;

  const valueEl = createElement('span', {
    className: `kpi-value${colorClass ? ' ' + colorClass : ''}`,
    id,
  });
  valueEl.textContent = typeof value === 'string' ? value : String(value);

  const labelEl = createElement('span', { className: 'kpi-label' });
  labelEl.textContent = label;

  appendChildren(card, [iconEl, valueEl, labelEl]);

  if (trend) {
    const trendEl = createElement('span', { className: 'kpi-trend' });
    const arrow = trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→';
    const trendClass =
      trendDirection === 'up' ? 'text-success' : trendDirection === 'down' ? 'text-error' : 'text-muted';
    trendEl.className = `kpi-trend ${trendClass}`;
    trendEl.textContent = `${arrow} ${Security.escapeHTML(trend)}`;
    card.appendChild(trendEl);
  }

  return card;
}

/**
 * Builds the KPI row with four key metrics.
 * @returns {HTMLElement} Grid container of KPI cards
 */
function _buildKpiRow() {
  const densities = _getVenueDensities();
  const totalAttendance = densities.reduce((sum, v) => sum + v.current, 0);
  const activeVenues = _getLiveMatches().length;
  const alerts = _getAlerts();
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
  const satisfaction = 87;

  _kpiCache = {
    attendance: totalAttendance,
    activeVenues,
    securityAlerts: unacknowledgedCount,
    fanSatisfaction: satisfaction,
  };

  const grid = createElement('div', { className: 'grid-4 content-section' });

  const attendanceCard = _buildKpiCard({
    id: 'kpi-attendance',
    icon: '👥',
    label: 'Total Attendance',
    value: formatCompactNumber(totalAttendance),
    trend: '+12.3%',
    trendDirection: 'up',
  });
  attendanceCard.style.setProperty('--delay', '0s');

  const venuesCard = _buildKpiCard({
    id: 'kpi-venues',
    icon: '🏟️',
    label: 'Active Venues',
    value: String(activeVenues),
  });
  venuesCard.style.setProperty('--delay', '0.05s');

  const alertSeverityClass = criticalCount > 0 ? 'text-error' : unacknowledgedCount > 0 ? 'text-warning' : 'text-success';
  const alertsCard = _buildKpiCard({
    id: 'kpi-alerts',
    icon: '🛡️',
    label: 'Security Alerts',
    value: String(unacknowledgedCount),
    colorClass: alertSeverityClass,
  });
  alertsCard.style.setProperty('--delay', '0.1s');

  const satisfactionCard = _buildKpiCard({
    id: 'kpi-satisfaction',
    icon: '⭐',
    label: 'Fan Satisfaction',
    value: formatPercentage(satisfaction / 100),
    trend: '+2.1%',
    trendDirection: 'up',
  });
  satisfactionCard.style.setProperty('--delay', '0.15s');

  appendChildren(grid, [attendanceCard, venuesCard, alertsCard, satisfactionCard]);
  return grid;
}

/**
 * Builds a single live match card.
 * @param {Object} match - Match data object
 * @returns {HTMLElement} The match-card element
 */
function _buildMatchCard(match) {
  const card = createElement('div', { className: 'match-card' });
  card.dataset.matchId = match.id;

  // Status row
  const statusRow = createElement('div', { className: 'match-status--live' });
  const dot = createElement('span', { className: 'status-dot status-dot--online' });
  const minuteText = createElement('span');
  minuteText.textContent = `${match.minute}'`;
  appendChildren(statusRow, [dot, minuteText]);

  // Home team row
  const homeRow = createElement('div', { className: 'team-row' });
  const homeName = createElement('span');
  homeName.textContent = Security.escapeHTML(match.homeTeam);
  const homeScore = createElement('strong');
  homeScore.textContent = String(match.homeScore);
  if (match.homeScore > match.awayScore) homeScore.classList.add('text-accent');
  appendChildren(homeRow, [homeName, homeScore]);

  // Away team row
  const awayRow = createElement('div', { className: 'team-row' });
  const awayName = createElement('span');
  awayName.textContent = Security.escapeHTML(match.awayTeam);
  const awayScore = createElement('strong');
  awayScore.textContent = String(match.awayScore);
  if (match.awayScore > match.homeScore) awayScore.classList.add('text-accent');
  appendChildren(awayRow, [awayName, awayScore]);

  // Venue info
  const venueInfo = createElement('div', { className: 'text-muted' });
  venueInfo.textContent = Security.escapeHTML(match.venue);

  appendChildren(card, [statusRow, homeRow, awayRow, venueInfo]);
  return card;
}

/**
 * Builds the "Live Matches" section.
 * @returns {HTMLElement} Card containing live matches or empty state
 */
function _buildLiveMatchesSection() {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '0.2s');
  card.id = 'dashboard-live-matches';

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Live Matches';
  const badge = createElement('span', { className: 'card-badge badge badge--error' });
  badge.textContent = 'LIVE';
  appendChildren(header, [title, badge]);

  const body = createElement('div', { className: 'card-body' });
  const matches = _getLiveMatches();

  if (matches.length === 0) {
    const empty = createElement('p', { className: 'text-muted' });
    empty.textContent = 'No live matches at the moment';
    body.appendChild(empty);
  } else {
    matches.forEach((m) => body.appendChild(_buildMatchCard(m)));
  }

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds a single venue crowd-density bar row.
 * @param {Object} venue - Venue density data
 * @returns {HTMLElement} Row element with label + progress bar
 */
function _buildDensityRow(venue) {
  const row = createElement('div', { className: 'animate-in' });
  row.style.marginBottom = '0.75rem';

  const labelRow = createElement('div');
  labelRow.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:0.25rem;';

  const name = createElement('span');
  name.textContent = Security.escapeHTML(venue.name);

  const pct = createElement('span', {
    className:
      venue.percentage > 85 ? 'text-error' : venue.percentage > 60 ? 'text-warning' : 'text-success',
  });
  pct.textContent = `${venue.percentage}%`;

  appendChildren(labelRow, [name, pct]);

  const bar = createElement('div', { className: 'progress-bar' });
  const fill = createElement('div', { className: 'progress-fill' });
  fill.style.width = `${venue.percentage}%`;
  if (venue.percentage > 85) {
    fill.style.backgroundColor = 'var(--color-error, #ef4444)';
  } else if (venue.percentage > 60) {
    fill.style.backgroundColor = 'var(--color-warning, #f59e0b)';
  } else {
    fill.style.backgroundColor = 'var(--color-success, #22c55e)';
  }
  bar.appendChild(fill);

  appendChildren(row, [labelRow, bar]);
  return row;
}

/**
 * Builds the "Crowd Density Overview" section.
 * @returns {HTMLElement} Card with top-6 venue density bars
 */
function _buildCrowdDensitySection() {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '0.25s');
  card.id = 'dashboard-crowd-density';

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Crowd Density Overview';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });
  const venues = _getVenueDensities().slice(0, 6);
  venues.forEach((v, i) => {
    const row = _buildDensityRow(v);
    row.style.setProperty('--delay', `${0.3 + i * 0.05}s`);
    body.appendChild(row);
  });

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds a single alert item element.
 * @param {Object} alert - Alert data
 * @returns {HTMLElement} The alert-item element
 */
function _buildAlertItem(alert) {
  const severityClass =
    alert.severity === 'critical'
      ? 'alert--critical'
      : alert.severity === 'warning'
        ? 'alert--warning'
        : 'alert--info';

  const item = createElement('div', {
    className: `alert-item ${severityClass} animate-in`,
    id: `alert-${alert.id}`,
  });

  const contentWrap = createElement('div');
  contentWrap.style.flex = '1';

  const titleEl = createElement('strong');
  titleEl.textContent = Security.escapeHTML(alert.title);

  const messageEl = createElement('p', { className: 'text-secondary' });
  messageEl.textContent = Security.escapeHTML(alert.message);
  messageEl.style.margin = '0.25rem 0';

  const timeEl = createElement('small', { className: 'text-muted' });
  timeEl.textContent = timeAgo(alert.timestamp);

  appendChildren(contentWrap, [titleEl, messageEl, timeEl]);
  item.appendChild(contentWrap);

  if (!alert.acknowledged) {
    const ackBtn = createElement('button', { className: 'btn btn--ghost btn--sm' });
    ackBtn.textContent = 'Acknowledge';
    ackBtn.setAttribute('aria-label', `Acknowledge alert: ${Security.escapeHTML(alert.title)}`);
    ackBtn.addEventListener('click', () => {
      _handleAlertAcknowledge(alert.id);
    });
    item.appendChild(ackBtn);
  } else {
    const ackBadge = createElement('span', { className: 'badge badge--success' });
    ackBadge.textContent = 'Acknowledged';
    item.appendChild(ackBadge);
  }

  return item;
}

/**
 * Handles acknowledging an alert — removes it from the UI and emits an event.
 * @param {string} alertId - Id of the alert to acknowledge
 */
function _handleAlertAcknowledge(alertId) {
  const alertEl = $(`#alert-${alertId}`);
  if (alertEl) {
    alertEl.style.opacity = '0';
    alertEl.style.transform = 'translateX(20px)';
    alertEl.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => {
      alertEl.remove();
      announceToScreenReader('Alert acknowledged');
    }, 300);
  }
  EventBus.emit('alert:dismiss', { id: alertId });
  _updateAlertKpi();
}

/**
 * Updates the security-alerts KPI after an acknowledgment.
 */
function _updateAlertKpi() {
  const remaining = $$('.alert-item button.btn--ghost');
  const count = remaining ? remaining.length - 1 : 0; // -1 because we already removed
  const el = $('#kpi-alerts');
  if (el) {
    el.textContent = String(Math.max(0, count));
  }
}

/**
 * Builds the "Recent Alerts" section.
 * @returns {HTMLElement} Section with alert items
 */
function _buildAlertsSection() {
  const section = createElement('section', { className: 'content-section' });
  section.id = 'dashboard-alerts';

  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Recent Alerts';
  title.style.marginBottom = '1rem';
  section.appendChild(title);

  const alerts = _getAlerts();
  alerts.forEach((a, i) => {
    const item = _buildAlertItem(a);
    item.style.setProperty('--delay', `${0.3 + i * 0.04}s`);
    section.appendChild(item);
  });

  return section;
}

/**
 * Builds a single venue status mini-card.
 * @param {Object} venue - Venue data
 * @returns {HTMLElement} Venue card element
 */
function _buildVenueStatusCard(venue) {
  const card = createElement('div', { className: 'venue-card animate-in' });

  const statusDotClass =
    venue.status === 'operational'
      ? 'status-dot--online'
      : venue.status === 'warning'
        ? 'status-dot--warning'
        : 'status-dot--offline';

  const headerRow = createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;';

  const dot = createElement('span', { className: `status-dot ${statusDotClass}` });

  const name = createElement('strong');
  name.textContent = Security.escapeHTML(venue.name);
  name.style.fontSize = '0.85rem';

  appendChildren(headerRow, [dot, name]);

  const city = createElement('div', { className: 'text-muted' });
  city.textContent = Security.escapeHTML(venue.city);
  city.style.fontSize = '0.8rem';

  const pctLabel = createElement('div', {
    className:
      venue.percentage > 85 ? 'text-error' : venue.percentage > 60 ? 'text-warning' : 'text-success',
  });
  pctLabel.textContent = `${venue.percentage}% capacity`;
  pctLabel.style.cssText = 'font-size:0.85rem;font-weight:600;margin-top:0.5rem;';

  const miniBar = createElement('div', { className: 'progress-bar' });
  miniBar.style.height = '4px';
  const miniFill = createElement('div', { className: 'progress-fill' });
  miniFill.style.width = `${venue.percentage}%`;
  if (venue.percentage > 85) miniFill.style.backgroundColor = 'var(--color-error, #ef4444)';
  else if (venue.percentage > 60) miniFill.style.backgroundColor = 'var(--color-warning, #f59e0b)';
  else miniFill.style.backgroundColor = 'var(--color-success, #22c55e)';
  miniBar.appendChild(miniFill);

  appendChildren(card, [headerRow, city, pctLabel, miniBar]);
  return card;
}

/**
 * Builds the "Venue Status Grid" section.
 * @returns {HTMLElement} Grid of venue status cards
 */
function _buildVenueStatusGrid() {
  const section = createElement('section', { className: 'content-section' });
  section.id = 'dashboard-venue-grid';

  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Venue Status Grid';
  title.style.marginBottom = '1rem';
  section.appendChild(title);

  const grid = createElement('div', { className: 'grid-4' });
  const venues = _getVenueDensities();
  venues.forEach((v, i) => {
    const card = _buildVenueStatusCard(v);
    card.style.setProperty('--delay', `${0.35 + i * 0.04}s`);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

/* ──────────────────────────────────────────────
   Live update handlers
   ────────────────────────────────────────────── */

/**
 * Handles crowd:update events — refreshes density bars and attendance KPI.
 * @param {Object} data - Event payload
 */
function _onCrowdUpdate(data) {
  const densitySection = $('#dashboard-crowd-density .card-body');
  if (densitySection) {
    clearElement(densitySection);
    const venues = _getVenueDensities().slice(0, 6);
    venues.forEach((v) => densitySection.appendChild(_buildDensityRow(v)));
  }

  // Animate attendance KPI
  const newTotal = _getVenueDensities().reduce((s, v) => s + v.current, 0);
  _animateValue('kpi-attendance', _kpiCache.attendance, newTotal, 800, formatCompactNumber);
  _kpiCache.attendance = newTotal;
}

/**
 * Handles match:update events — refreshes the live matches section.
 * @param {Object} data - Event payload
 */
function _onMatchUpdate(data) {
  const matchSection = $('#dashboard-live-matches .card-body');
  if (matchSection) {
    clearElement(matchSection);
    const matches = _getLiveMatches();
    if (matches.length === 0) {
      const empty = createElement('p', { className: 'text-muted' });
      empty.textContent = 'No live matches at the moment';
      matchSection.appendChild(empty);
    } else {
      matches.forEach((m) => matchSection.appendChild(_buildMatchCard(m)));
    }
  }
}

/**
 * Handles alert:new events — prepends a new alert to the alerts section.
 * @param {Object} data - Alert payload
 */
function _onNewAlert(data) {
  const section = $('#dashboard-alerts');
  if (!section) return;

  const alert = {
    id: `a-${Date.now()}`,
    severity: data.severity || 'info',
    title: data.title || 'New Alert',
    message: data.message || '',
    timestamp: Date.now(),
    acknowledged: false,
  };

  const item = _buildAlertItem(alert);
  // Insert after the title
  const firstAlert = section.querySelector('.alert-item');
  if (firstAlert) {
    section.insertBefore(item, firstAlert);
  } else {
    section.appendChild(item);
  }

  _updateAlertKpi();
  announceToScreenReader(`New ${alert.severity} alert: ${alert.title}`);
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Initialises the Operations Dashboard module, rendering all sections into
 * the provided container element.
 *
 * @param {HTMLElement} container - The DOM element to render the dashboard into
 */
export function init(container) {
  _container = container;
  clearElement(_container);

  // Build all sections
  const header = _buildHeader();
  const kpiRow = _buildKpiRow();

  // Two-column layout: live matches + crowd density
  const twoCol = createElement('div', { className: 'grid-2 content-section' });
  twoCol.appendChild(_buildLiveMatchesSection());
  twoCol.appendChild(_buildCrowdDensitySection());

  const divider1 = createElement('hr', { className: 'divider' });
  const alertsSection = _buildAlertsSection();
  const divider2 = createElement('hr', { className: 'divider' });
  const venueGrid = _buildVenueStatusGrid();

  appendChildren(_container, [header, kpiRow, twoCol, divider1, alertsSection, divider2, venueGrid]);

  // Subscribe to live events
  _subscriptions.push(EventBus.on('crowd:update', _onCrowdUpdate));
  _subscriptions.push(EventBus.on('match:update', _onMatchUpdate));
  _subscriptions.push(EventBus.on('alert:new', _onNewAlert));

  // Simulated periodic data refresh (every 30 s)
  _dataRefreshInterval = setInterval(() => {
    _onCrowdUpdate({});
    _onMatchUpdate({});
  }, 30000);

  announceToScreenReader('Operations Dashboard loaded');
}

/**
 * Destroys the dashboard module — cleans up all intervals, subscriptions,
 * animation frames, and DOM references.
 */
export function destroy() {
  // Clear clock interval
  if (_clockInterval !== null) {
    clearInterval(_clockInterval);
    _clockInterval = null;
  }

  // Clear data refresh interval
  if (_dataRefreshInterval !== null) {
    clearInterval(_dataRefreshInterval);
    _dataRefreshInterval = null;
  }

  // Cancel all animation frames
  _animationFrames.forEach((frameId) => cancelAnimationFrame(frameId));
  _animationFrames.clear();

  // Unsubscribe from EventBus
  _subscriptions.forEach((unsub) => {
    if (typeof unsub === 'function') unsub();
  });
  _subscriptions.length = 0;

  // Clear DOM
  if (_container) {
    clearElement(_container);
    _container = null;
  }

  // Reset KPI cache
  _kpiCache = { attendance: 0, activeVenues: 0, securityAlerts: 0, fanSatisfaction: 0 };
}
