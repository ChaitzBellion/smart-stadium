/**
 * @fileoverview Venue Operations Module — Facility Management Dashboard
 *
 * Provides a comprehensive operations dashboard for venue managers at
 * FIFA World Cup 2026 stadiums. Displays real-time facility status,
 * maintenance tracking, and resource allocation.
 *
 * @module modules/venue-ops
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
} from '../utils/formatters.js';
import { EventBus } from '../services/event-bus.js';
import { StateManager } from '../services/state-manager.js';
import { DataService } from '../services/data-service.js';
import { Security } from '../services/security.js';

/* ------------------------------------------------------------------ */
/*  Module-level State                                                */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} */
let _container = null;

/** @type {string} Currently selected venue ID */
let _selectedVenueId = 'lusail';

/** @type {Function[]} EventBus unsubscribe handles */
let _unsubscribers = [];

/** @type {number|null} Data refresh interval ID */
let _refreshInterval = null;

/** @constant {number} Refresh interval in milliseconds */
const REFRESH_INTERVAL_MS = 30000;

/* ------------------------------------------------------------------ */
/*  Venue & Facility Data                                             */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} VenueData
 * @property {string}  id           Unique venue identifier.
 * @property {string}  name         Official venue name.
 * @property {string}  city         Host city.
 * @property {string}  country      Host country.
 * @property {number}  capacity     Maximum spectator capacity.
 * @property {string}  status       Current operational status: 'operational'|'warning'|'critical'.
 * @property {object}  stats        Summary statistics for the venue.
 * @property {object}  facilities   Per-facility-type detailed data.
 * @property {Array}   maintenance  Maintenance tracker items.
 * @property {object}  staffing     Staff deployment data.
 */

/**
 * Returns a full dataset for every supported venue.
 *
 * @returns {Object<string, VenueData>}
 */
function _getVenueData() {
  return {
    lusail: {
      id: 'lusail',
      name: 'MetLife Stadium',
      city: 'East Rutherford, NJ',
      country: 'United States',
      capacity: 82500,
      status: 'operational',
      stats: { gates: 12, concessions: 48, medical: 6, security: 24 },
      facilities: {
        gates: [
          { name: 'Gate A', status: 'open', throughput: 142, queueMin: 3 },
          { name: 'Gate B', status: 'open', throughput: 128, queueMin: 5 },
          { name: 'Gate C', status: 'restricted', throughput: 64, queueMin: 12 },
          { name: 'Gate D', status: 'open', throughput: 155, queueMin: 2 },
          { name: 'Gate E', status: 'open', throughput: 133, queueMin: 4 },
          { name: 'Gate F', status: 'closed', throughput: 0, queueMin: 0 },
        ],
        concessions: { open: 42, total: 48, busiest: ['Main Food Court', 'Section 114 Bar', 'Level 3 Grill'], revenue: 487200 },
        medical: { available: 5, total: 6, casesLow: 12, casesMedium: 3, responseTimeMin: 2.4 },
        security: { active: 186, total: 210, incidentsToday: 7, coverageStatus: 'optimal' },
        hvac: { tempF: 72, tempC: 22, humidity: 48, systemStatus: 'nominal' },
        restrooms: { clean: 82, inUse: 34, maintenance: 4, waitTimeMin: 2 },
      },
      maintenance: [
        { id: 'MNT-001', issue: 'Broken turnstile Gate C', location: 'Gate C', priority: 'high', status: 'in-progress', assigned: 'T. Martinez', eta: '15 min' },
        { id: 'MNT-002', issue: 'Water leak Section 204', location: 'Section 204', priority: 'critical', status: 'dispatched', assigned: 'R. Johnson', eta: '8 min' },
        { id: 'MNT-003', issue: 'Scoreboard display glitch', location: 'Main Board', priority: 'medium', status: 'in-progress', assigned: 'K. Wong', eta: '25 min' },
        { id: 'MNT-004', issue: 'Elevator #3 stuck', location: 'East Wing', priority: 'high', status: 'dispatched', assigned: 'M. Ali', eta: '10 min' },
        { id: 'MNT-005', issue: 'PA system crackling Sec 300', location: 'Section 300', priority: 'low', status: 'queued', assigned: 'Unassigned', eta: '45 min' },
        { id: 'MNT-006', issue: 'Concession POS down', location: 'Food Court B', priority: 'high', status: 'in-progress', assigned: 'S. Park', eta: '12 min' },
        { id: 'MNT-007', issue: 'Restroom sensor fault', location: 'Level 2 East', priority: 'medium', status: 'queued', assigned: 'L. Gomez', eta: '30 min' },
        { id: 'MNT-008', issue: 'Cracked seat Section 118 Row 12', location: 'Section 118', priority: 'low', status: 'scheduled', assigned: 'D. Brown', eta: '90 min' },
      ],
      staffing: {
        security: { deployed: 186, total: 210 },
        medical: { deployed: 22, total: 28 },
        cleaning: { deployed: 64, total: 80 },
        concessions: { deployed: 155, total: 170 },
        technical: { deployed: 18, total: 25 },
      },
    },
    azteca: {
      id: 'azteca',
      name: 'Estadio Azteca',
      city: 'Mexico City',
      country: 'Mexico',
      capacity: 87523,
      status: 'warning',
      stats: { gates: 14, concessions: 52, medical: 8, security: 28 },
      facilities: {
        gates: [
          { name: 'Puerta 1', status: 'open', throughput: 160, queueMin: 2 },
          { name: 'Puerta 2', status: 'open', throughput: 145, queueMin: 4 },
          { name: 'Puerta 3', status: 'open', throughput: 138, queueMin: 6 },
          { name: 'Puerta 4', status: 'restricted', throughput: 55, queueMin: 15 },
          { name: 'Puerta 5', status: 'open', throughput: 152, queueMin: 3 },
          { name: 'Puerta 6', status: 'open', throughput: 130, queueMin: 5 },
        ],
        concessions: { open: 48, total: 52, busiest: ['Zona Gourmet', 'Cerveza Garden', 'Tacos Express'], revenue: 623400 },
        medical: { available: 6, total: 8, casesLow: 18, casesMedium: 5, responseTimeMin: 3.1 },
        security: { active: 220, total: 245, incidentsToday: 12, coverageStatus: 'warning' },
        hvac: { tempF: 78, tempC: 26, humidity: 62, systemStatus: 'elevated-load' },
        restrooms: { clean: 74, inUse: 42, maintenance: 8, waitTimeMin: 5 },
      },
      maintenance: [
        { id: 'MNT-101', issue: 'Puerta 4 scanner malfunction', location: 'Puerta 4', priority: 'high', status: 'in-progress', assigned: 'C. Rivera', eta: '20 min' },
        { id: 'MNT-102', issue: 'HVAC overload Zone B', location: 'Zone B', priority: 'critical', status: 'in-progress', assigned: 'J. Hernandez', eta: '35 min' },
        { id: 'MNT-103', issue: 'Flood in restroom Level 1', location: 'Level 1 West', priority: 'high', status: 'dispatched', assigned: 'P. Lopez', eta: '10 min' },
        { id: 'MNT-104', issue: 'Broken railing Section 312', location: 'Section 312', priority: 'critical', status: 'dispatched', assigned: 'A. Garcia', eta: '15 min' },
        { id: 'MNT-105', issue: 'Flickering lights Concourse E', location: 'Concourse E', priority: 'medium', status: 'queued', assigned: 'Unassigned', eta: '50 min' },
        { id: 'MNT-106', issue: 'WiFi AP down Section 200', location: 'Section 200', priority: 'medium', status: 'in-progress', assigned: 'R. Sanchez', eta: '18 min' },
      ],
      staffing: {
        security: { deployed: 220, total: 245 },
        medical: { deployed: 28, total: 35 },
        cleaning: { deployed: 72, total: 95 },
        concessions: { deployed: 180, total: 200 },
        technical: { deployed: 22, total: 30 },
      },
    },
    bmo: {
      id: 'bmo',
      name: 'BMO Field',
      city: 'Toronto',
      country: 'Canada',
      capacity: 45736,
      status: 'operational',
      stats: { gates: 8, concessions: 30, medical: 4, security: 16 },
      facilities: {
        gates: [
          { name: 'Gate 1', status: 'open', throughput: 110, queueMin: 2 },
          { name: 'Gate 2', status: 'open', throughput: 105, queueMin: 3 },
          { name: 'Gate 3', status: 'open', throughput: 98, queueMin: 4 },
          { name: 'Gate 4', status: 'open', throughput: 115, queueMin: 1 },
        ],
        concessions: { open: 28, total: 30, busiest: ['Poutine Stand', 'Maple Grill', 'Craft Beer Bar'], revenue: 215600 },
        medical: { available: 4, total: 4, casesLow: 5, casesMedium: 1, responseTimeMin: 1.8 },
        security: { active: 98, total: 110, incidentsToday: 2, coverageStatus: 'optimal' },
        hvac: { tempF: 68, tempC: 20, humidity: 44, systemStatus: 'nominal' },
        restrooms: { clean: 48, inUse: 18, maintenance: 2, waitTimeMin: 1 },
      },
      maintenance: [
        { id: 'MNT-201', issue: 'Loose handrail Section 105', location: 'Section 105', priority: 'low', status: 'scheduled', assigned: 'B. Chen', eta: '60 min' },
        { id: 'MNT-202', issue: 'Concession fridge not cooling', location: 'Stand C12', priority: 'medium', status: 'in-progress', assigned: 'N. Patel', eta: '20 min' },
        { id: 'MNT-203', issue: 'Directional sign fallen', location: 'East Concourse', priority: 'low', status: 'queued', assigned: 'Unassigned', eta: '40 min' },
        { id: 'MNT-204', issue: 'Accessible ramp scuff marks', location: 'Gate 2', priority: 'low', status: 'scheduled', assigned: 'C. Lee', eta: '120 min' },
        { id: 'MNT-205', issue: 'LED board pixel cluster out', location: 'South Stand', priority: 'medium', status: 'in-progress', assigned: 'J. Smith', eta: '30 min' },
        { id: 'MNT-206', issue: 'Fire extinguisher expired', location: 'Level 2 Section 208', priority: 'high', status: 'dispatched', assigned: 'K. Williams', eta: '10 min' },
      ],
      staffing: {
        security: { deployed: 98, total: 110 },
        medical: { deployed: 14, total: 18 },
        cleaning: { deployed: 38, total: 45 },
        concessions: { deployed: 95, total: 105 },
        technical: { deployed: 12, total: 16 },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helper: Status Mapping                                            */
/* ------------------------------------------------------------------ */

/**
 * Maps a status string to the corresponding badge CSS modifier.
 *
 * @param {string} status  'operational'|'warning'|'critical' or gate-level status.
 * @returns {{label:string, badgeClass:string, dotClass:string}}
 */
function _mapStatus(status) {
  const map = {
    operational: { label: 'Operational', badgeClass: 'badge--success', dotClass: 'status-dot--online' },
    open: { label: 'Open', badgeClass: 'badge--success', dotClass: 'status-dot--online' },
    nominal: { label: 'Nominal', badgeClass: 'badge--success', dotClass: 'status-dot--online' },
    optimal: { label: 'Optimal', badgeClass: 'badge--success', dotClass: 'status-dot--online' },
    warning: { label: 'Warning', badgeClass: 'badge--warning', dotClass: 'status-dot--warning' },
    restricted: { label: 'Restricted', badgeClass: 'badge--warning', dotClass: 'status-dot--warning' },
    'elevated-load': { label: 'Elevated Load', badgeClass: 'badge--warning', dotClass: 'status-dot--warning' },
    critical: { label: 'Critical', badgeClass: 'badge--error', dotClass: 'status-dot--offline' },
    closed: { label: 'Closed', badgeClass: 'badge--error', dotClass: 'status-dot--offline' },
  };
  return map[status] || { label: status, badgeClass: 'badge--info', dotClass: '' };
}

/**
 * Maps maintenance priority to a badge class.
 *
 * @param {string} priority 'low'|'medium'|'high'|'critical'
 * @returns {string} CSS class for badge.
 */
function _priorityBadge(priority) {
  const map = { low: 'badge--info', medium: 'badge--warning', high: 'badge--error', critical: 'badge--error' };
  return map[priority] || 'badge--info';
}

/**
 * Maps maintenance status to a badge class.
 *
 * @param {string} status 'queued'|'scheduled'|'dispatched'|'in-progress'|'done'
 * @returns {string}
 */
function _maintenanceStatusBadge(status) {
  const map = {
    'queued': 'badge--info',
    'scheduled': 'badge--info',
    'dispatched': 'badge--warning',
    'in-progress': 'badge--warning',
    'done': 'badge--success',
  };
  return map[status] || 'badge--info';
}

/* ------------------------------------------------------------------ */
/*  DOM Builders                                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds the venue selector dropdown.
 *
 * @param {Object<string,VenueData>} venues All venue data keyed by ID.
 * @returns {HTMLSelectElement}
 */
function _buildVenueSelector(venues) {
  const select = createElement('select', {
    className: 'search-input',
    'aria-label': 'Select venue',
  });
  select.style.cssText = 'max-width:280px;';

  Object.values(venues).forEach((v) => {
    const option = createElement('option', { value: v.id });
    option.textContent = `${v.name} — ${v.city}`;
    if (v.id === _selectedVenueId) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    _selectedVenueId = select.value;
    _renderContent();
  });

  return select;
}

/**
 * Builds the venue info card (full-width hero).
 *
 * @param {VenueData} venue
 * @returns {HTMLElement}
 */
function _buildVenueInfoCard(venue) {
  const card = createElement('div', { className: 'card animate-in' });

  const header = createElement('div', { className: 'card-header' });
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';

  const nameEl = createElement('h2', { className: 'card-title' });
  nameEl.textContent = Security.escapeHTML(venue.name);

  const statusInfo = _mapStatus(venue.status);
  const statusBadge = createElement('span', { className: `badge ${statusInfo.badgeClass}` });
  const dot = createElement('span', { className: `status-dot ${statusInfo.dotClass}` });
  dot.style.marginRight = '6px';
  statusBadge.appendChild(dot);
  const statusText = createElement('span');
  statusText.textContent = statusInfo.label;
  statusBadge.appendChild(statusText);

  appendChildren(header, [nameEl, statusBadge]);

  const body = createElement('div', { className: 'card-body' });

  const location = createElement('p', { className: 'text-secondary' });
  location.textContent = `📍 ${Security.escapeHTML(venue.city)}, ${Security.escapeHTML(venue.country)}  ·  🏟️ Capacity: ${formatNumber(venue.capacity)}`;

  const statsRow = createElement('div', { className: 'grid-4' });
  statsRow.style.cssText = 'margin-top:12px;';

  const miniStats = [
    { icon: '🚪', label: 'Total Gates', value: venue.stats.gates },
    { icon: '🍔', label: 'Concessions', value: venue.stats.concessions },
    { icon: '🏥', label: 'Medical Stations', value: venue.stats.medical },
    { icon: '🛡️', label: 'Security Posts', value: venue.stats.security },
  ];

  miniStats.forEach((stat) => {
    const kpi = createElement('div', { className: 'kpi-card' });
    const icon = createElement('span', { className: 'kpi-icon' });
    icon.textContent = stat.icon;
    const val = createElement('span', { className: 'kpi-value' });
    val.textContent = String(stat.value);
    const lbl = createElement('span', { className: 'kpi-label' });
    lbl.textContent = stat.label;
    appendChildren(kpi, [icon, val, lbl]);
    statsRow.appendChild(kpi);
  });

  appendChildren(body, [location, statsRow]);
  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the Gates facility card.
 *
 * @param {Array} gates
 * @returns {HTMLElement}
 */
function _buildGatesCard(gates) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '100ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🚪 Gates';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });

  gates.forEach((gate) => {
    const row = createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color, #333);';

    const nameEl = createElement('span');
    nameEl.textContent = Security.escapeHTML(gate.name);
    nameEl.style.fontWeight = '600';

    const statusInfo = _mapStatus(gate.status);
    const statusDot = createElement('span', { className: `status-dot ${statusInfo.dotClass}` });

    const statusLabel = createElement('span', { className: `badge ${statusInfo.badgeClass}` });
    statusLabel.textContent = statusInfo.label;
    statusLabel.style.fontSize = '0.75rem';

    const meta = createElement('span', { className: 'text-muted' });
    meta.style.fontSize = '0.8rem';
    if (gate.status !== 'closed') {
      meta.textContent = `${gate.throughput}/min  ·  ~${gate.queueMin} min wait`;
    } else {
      meta.textContent = 'Closed';
    }

    const left = createElement('span');
    left.style.cssText = 'display:flex;align-items:center;gap:8px;';
    appendChildren(left, [statusDot, nameEl]);

    const right = createElement('span');
    right.style.cssText = 'display:flex;align-items:center;gap:10px;';
    appendChildren(right, [meta, statusLabel]);

    appendChildren(row, [left, right]);
    body.appendChild(row);
  });

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the Concessions facility card.
 *
 * @param {object} data
 * @returns {HTMLElement}
 */
function _buildConcessionsCard(data) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '150ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🍔 Concessions';
  const badge = createElement('span', { className: 'card-badge badge--success' });
  badge.textContent = `${data.open}/${data.total} Open`;
  appendChildren(header, [title, badge]);

  const body = createElement('div', { className: 'card-body' });

  // Progress bar for open concessions
  const progressWrap = createElement('div', { className: 'progress-bar' });
  const progressFill = createElement('div', { className: 'progress-fill' });
  progressFill.style.width = formatPercentage(data.open / data.total);
  progressWrap.appendChild(progressFill);

  const busiestTitle = createElement('p');
  busiestTitle.style.cssText = 'margin-top:10px;font-weight:600;font-size:0.85rem;';
  busiestTitle.textContent = 'Busiest Locations:';

  const busiestList = createElement('ul');
  busiestList.style.cssText = 'margin:4px 0 10px 16px;font-size:0.85rem;';
  data.busiest.forEach((loc) => {
    const li = createElement('li');
    li.textContent = Security.escapeHTML(loc);
    li.style.padding = '2px 0';
    busiestList.appendChild(li);
  });

  const revenueEl = createElement('p', { className: 'text-accent' });
  revenueEl.style.fontWeight = '600';
  revenueEl.textContent = `💰 Revenue: $${formatCompactNumber(data.revenue)}`;

  appendChildren(body, [progressWrap, busiestTitle, busiestList, revenueEl]);
  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the Medical facility card.
 *
 * @param {object} data
 * @returns {HTMLElement}
 */
function _buildMedicalCard(data) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '200ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🏥 Medical';
  const badge = createElement('span', { className: `card-badge ${data.available === data.total ? 'badge--success' : 'badge--warning'}` });
  badge.textContent = `${data.available}/${data.total} Available`;
  appendChildren(header, [title, badge]);

  const body = createElement('div', { className: 'card-body' });

  const items = [
    { label: 'Low-severity cases', value: data.casesLow, cls: 'text-success' },
    { label: 'Medium-severity cases', value: data.casesMedium, cls: 'text-warning' },
    { label: 'Avg. response time', value: `${data.responseTimeMin} min`, cls: 'text-accent' },
  ];

  items.forEach((item) => {
    const row = createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;';
    const lbl = createElement('span', { className: 'text-secondary' });
    lbl.style.fontSize = '0.85rem';
    lbl.textContent = item.label;
    const val = createElement('span', { className: item.cls });
    val.style.cssText = 'font-weight:600;font-size:0.85rem;';
    val.textContent = String(item.value);
    appendChildren(row, [lbl, val]);
    body.appendChild(row);
  });

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the Security facility card.
 *
 * @param {object} data
 * @returns {HTMLElement}
 */
function _buildSecurityCard(data) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '250ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🛡️ Security';
  const coverageInfo = _mapStatus(data.coverageStatus);
  const badge = createElement('span', { className: `card-badge ${coverageInfo.badgeClass}` });
  badge.textContent = coverageInfo.label;
  appendChildren(header, [title, badge]);

  const body = createElement('div', { className: 'card-body' });

  const items = [
    { label: 'Active personnel', value: `${data.active}/${data.total}` },
    { label: 'Incidents today', value: data.incidentsToday, cls: data.incidentsToday > 10 ? 'text-warning' : 'text-success' },
    { label: 'Coverage status', value: coverageInfo.label },
  ];

  items.forEach((item) => {
    const row = createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;';
    const lbl = createElement('span', { className: 'text-secondary' });
    lbl.style.fontSize = '0.85rem';
    lbl.textContent = item.label;
    const val = createElement('span', { className: item.cls || '' });
    val.style.cssText = 'font-weight:600;font-size:0.85rem;';
    val.textContent = String(item.value);
    appendChildren(row, [lbl, val]);
    body.appendChild(row);
  });

  // Progress bar for personnel
  const progressWrap = createElement('div', { className: 'progress-bar' });
  progressWrap.style.marginTop = '8px';
  const progressFill = createElement('div', { className: 'progress-fill' });
  progressFill.style.width = formatPercentage(data.active / data.total);
  progressWrap.appendChild(progressFill);
  body.appendChild(progressWrap);

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the HVAC facility card.
 *
 * @param {object} data
 * @returns {HTMLElement}
 */
function _buildHVACCard(data) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '300ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🌡️ HVAC';
  const statusInfo = _mapStatus(data.systemStatus);
  const badge = createElement('span', { className: `card-badge ${statusInfo.badgeClass}` });
  badge.textContent = statusInfo.label;
  appendChildren(header, [title, badge]);

  const body = createElement('div', { className: 'card-body' });

  const tempRow = createElement('div');
  tempRow.style.cssText = 'text-align:center;padding:8px 0;';
  const tempVal = createElement('span', { className: 'kpi-value' });
  tempVal.textContent = `${data.tempF}°F / ${data.tempC}°C`;
  const tempLabel = createElement('span', { className: 'kpi-label' });
  tempLabel.textContent = 'Temperature';
  tempLabel.style.display = 'block';
  appendChildren(tempRow, [tempVal, tempLabel]);

  const humidityRow = createElement('div');
  humidityRow.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;margin-top:8px;';
  const humLbl = createElement('span', { className: 'text-secondary' });
  humLbl.style.fontSize = '0.85rem';
  humLbl.textContent = 'Humidity';
  const humVal = createElement('span');
  humVal.style.cssText = 'font-weight:600;font-size:0.85rem;';
  humVal.textContent = `${data.humidity}%`;
  appendChildren(humidityRow, [humLbl, humVal]);

  const statusRow = createElement('div');
  statusRow.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;';
  const sysLbl = createElement('span', { className: 'text-secondary' });
  sysLbl.style.fontSize = '0.85rem';
  sysLbl.textContent = 'System';
  const sysDot = createElement('span', { className: `status-dot ${statusInfo.dotClass}` });
  sysDot.style.marginLeft = '6px';
  const sysVal = createElement('span');
  sysVal.style.cssText = 'font-weight:600;font-size:0.85rem;';
  sysVal.textContent = statusInfo.label;
  const sysWrap = createElement('span');
  sysWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
  appendChildren(sysWrap, [sysDot, sysVal]);
  appendChildren(statusRow, [sysLbl, sysWrap]);

  appendChildren(body, [tempRow, humidityRow, statusRow]);
  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the Restrooms facility card.
 *
 * @param {object} data
 * @returns {HTMLElement}
 */
function _buildRestroomsCard(data) {
  const card = createElement('div', { className: 'card animate-in' });
  card.style.setProperty('--delay', '350ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '🚻 Restrooms';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });

  const total = data.clean + data.inUse + data.maintenance;

  const segments = [
    { label: 'Clean', value: data.clean, cls: 'text-success' },
    { label: 'In Use', value: data.inUse, cls: 'text-warning' },
    { label: 'Maintenance', value: data.maintenance, cls: 'text-error' },
  ];

  segments.forEach((seg) => {
    const row = createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;';
    const lbl = createElement('span', { className: 'text-secondary' });
    lbl.style.fontSize = '0.85rem';
    lbl.textContent = seg.label;
    const val = createElement('span', { className: seg.cls });
    val.style.cssText = 'font-weight:600;font-size:0.85rem;';
    val.textContent = String(seg.value);
    appendChildren(row, [lbl, val]);
    body.appendChild(row);
  });

  const waitRow = createElement('div');
  waitRow.style.cssText = 'margin-top:8px;padding:6px 0;border-top:1px solid var(--border-color, #333);display:flex;justify-content:space-between;';
  const waitLbl = createElement('span', { className: 'text-secondary' });
  waitLbl.style.fontSize = '0.85rem';
  waitLbl.textContent = 'Avg. wait time';
  const waitVal = createElement('span', { className: 'text-accent' });
  waitVal.style.cssText = 'font-weight:600;font-size:0.85rem;';
  waitVal.textContent = `~${data.waitTimeMin} min`;
  appendChildren(waitRow, [waitLbl, waitVal]);
  body.appendChild(waitRow);

  // Progress bar for clean ratio
  const progressWrap = createElement('div', { className: 'progress-bar' });
  progressWrap.style.marginTop = '8px';
  const progressFill = createElement('div', { className: 'progress-fill' });
  progressFill.style.width = formatPercentage(data.clean / total);
  progressWrap.appendChild(progressFill);
  body.appendChild(progressWrap);

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the maintenance tracker table.
 *
 * @param {Array} items
 * @returns {HTMLElement}
 */
function _buildMaintenanceTable(items) {
  const section = createElement('div', { className: 'animate-in' });
  section.style.setProperty('--delay', '400ms');

  const heading = createElement('h3');
  heading.textContent = '🔧 Maintenance Tracker';
  heading.style.cssText = 'margin:24px 0 12px;';

  const container = createElement('div', { className: 'table-container' });
  const table = createElement('table');

  // Header
  const thead = createElement('thead');
  const headerRow = createElement('tr');
  ['ID', 'Issue', 'Location', 'Priority', 'Status', 'Assigned', 'ETA'].forEach((col) => {
    const th = createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Body
  const tbody = createElement('tbody');
  items.forEach((item) => {
    const tr = createElement('tr');

    const tdId = createElement('td');
    tdId.textContent = Security.escapeHTML(item.id);
    tdId.style.cssText = 'font-family:monospace;font-size:0.8rem;';

    const tdIssue = createElement('td');
    tdIssue.textContent = Security.escapeHTML(item.issue);

    const tdLocation = createElement('td');
    tdLocation.textContent = Security.escapeHTML(item.location);

    const tdPriority = createElement('td');
    const priBadge = createElement('span', { className: `badge ${_priorityBadge(item.priority)}` });
    priBadge.textContent = item.priority.charAt(0).toUpperCase() + item.priority.slice(1);
    tdPriority.appendChild(priBadge);

    const tdStatus = createElement('td');
    const staBadge = createElement('span', { className: `badge ${_maintenanceStatusBadge(item.status)}` });
    staBadge.textContent = item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('-', ' ');
    tdStatus.appendChild(staBadge);

    const tdAssigned = createElement('td');
    tdAssigned.textContent = Security.escapeHTML(item.assigned);

    const tdEta = createElement('td', { className: 'text-accent' });
    tdEta.textContent = item.eta;
    tdEta.style.fontWeight = '600';

    appendChildren(tr, [tdId, tdIssue, tdLocation, tdPriority, tdStatus, tdAssigned, tdEta]);
    tbody.appendChild(tr);
  });

  appendChildren(table, [thead, tbody]);
  container.appendChild(table);
  appendChildren(section, [heading, container]);
  return section;
}

/**
 * Builds the Resource Allocation section with horizontal deployment bars.
 *
 * @param {object} staffing
 * @returns {HTMLElement}
 */
function _buildResourceAllocation(staffing) {
  const section = createElement('div', { className: 'card animate-in' });
  section.style.setProperty('--delay', '450ms');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = '👥 Resource Allocation';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });

  const categoryLabels = {
    security: '🛡️ Security',
    medical: '🏥 Medical',
    cleaning: '🧹 Cleaning',
    concessions: '🍔 Concessions',
    technical: '🔧 Technical',
  };

  Object.keys(staffing).forEach((key) => {
    const data = staffing[key];
    const pct = data.total > 0 ? data.deployed / data.total : 0;

    const row = createElement('div');
    row.style.cssText = 'margin-bottom:14px;';

    const labelRow = createElement('div');
    labelRow.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;';

    const lbl = createElement('span');
    lbl.style.cssText = 'font-weight:600;font-size:0.85rem;';
    lbl.textContent = categoryLabels[key] || key;

    const stats = createElement('span', { className: 'text-secondary' });
    stats.style.fontSize = '0.85rem';
    stats.textContent = `${data.deployed} / ${data.total} deployed (${formatPercentage(pct)})`;

    appendChildren(labelRow, [lbl, stats]);

    const progressWrap = createElement('div', { className: 'progress-bar' });
    const progressFill = createElement('div', { className: 'progress-fill' });
    progressFill.style.width = formatPercentage(pct);
    // Color-code: green if > 80%, orange if > 60%, red if < 60%
    if (pct >= 0.9) {
      progressFill.style.background = 'var(--color-success, #22c55e)';
    } else if (pct >= 0.7) {
      progressFill.style.background = 'var(--color-accent, #3b82f6)';
    } else {
      progressFill.style.background = 'var(--color-warning, #f59e0b)';
    }
    progressWrap.appendChild(progressFill);

    appendChildren(row, [labelRow, progressWrap]);
    body.appendChild(row);
  });

  appendChildren(section, [header, body]);
  return section;
}

/* ------------------------------------------------------------------ */
/*  Content Rendering                                                 */
/* ------------------------------------------------------------------ */

/** @type {HTMLElement|null} Content area below the header */
let _contentArea = null;

/**
 * Renders all venue-specific content for the currently selected venue.
 */
function _renderContent() {
  if (!_contentArea) return;
  clearElement(_contentArea);

  const venues = _getVenueData();
  const venue = venues[_selectedVenueId];
  if (!venue) return;

  // 1. Venue info card
  _contentArea.appendChild(_buildVenueInfoCard(venue));

  // 2. Divider
  const div1 = createElement('div', { className: 'divider' });
  _contentArea.appendChild(div1);

  // 3. Facility Status Grid
  const facilityHeading = createElement('h3');
  facilityHeading.textContent = '📊 Facility Status';
  facilityHeading.style.cssText = 'margin:16px 0 12px;';
  _contentArea.appendChild(facilityHeading);

  const facilityGrid = createElement('div', { className: 'grid-3' });

  facilityGrid.appendChild(_buildGatesCard(venue.facilities.gates));
  facilityGrid.appendChild(_buildConcessionsCard(venue.facilities.concessions));
  facilityGrid.appendChild(_buildMedicalCard(venue.facilities.medical));
  facilityGrid.appendChild(_buildSecurityCard(venue.facilities.security));
  facilityGrid.appendChild(_buildHVACCard(venue.facilities.hvac));
  facilityGrid.appendChild(_buildRestroomsCard(venue.facilities.restrooms));

  _contentArea.appendChild(facilityGrid);

  // 4. Maintenance Tracker
  _contentArea.appendChild(_buildMaintenanceTable(venue.maintenance));

  // 5. Divider
  const div2 = createElement('div', { className: 'divider' });
  _contentArea.appendChild(div2);

  // 6. Resource Allocation
  _contentArea.appendChild(_buildResourceAllocation(venue.staffing));

  announceToScreenReader(`Displaying data for ${venue.name}`);
}

/* ------------------------------------------------------------------ */
/*  Build the Full UI                                                 */
/* ------------------------------------------------------------------ */

/**
 * Constructs the complete Venue Operations DOM tree.
 *
 * @returns {HTMLElement}
 */
function _buildUI() {
  const root = createElement('div', { className: 'content-section' });

  /* ---- Page Header ---- */
  const header = createElement('div', { className: 'page-header' });
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;';

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = '🏟️ Venue Operations';

  const venues = _getVenueData();
  const selector = _buildVenueSelector(venues);

  appendChildren(header, [title, selector]);

  /* ---- Content Area ---- */
  _contentArea = createElement('div');

  appendChildren(root, [header, _contentArea]);

  return root;
}

/* ------------------------------------------------------------------ */
/*  EventBus Handlers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Handles incoming `venue:status` events to trigger re-renders.
 *
 * @param {object} data Event payload with `venueId` and updated data.
 */
function _onVenueStatusUpdate(data) {
  if (data && data.venueId === _selectedVenueId) {
    _renderContent();
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Initialises the Venue Operations module and renders it into the given container.
 *
 * @param {HTMLElement} container The DOM element to render into.
 */
export function init(container) {
  _container = container;
  clearElement(_container);

  const ui = _buildUI();
  _container.appendChild(ui);
  _renderContent();

  // Subscribe to venue status events
  const unsub = EventBus.on
    ? EventBus.on('venue:status', _onVenueStatusUpdate)
    : EventBus.subscribe
      ? EventBus.subscribe('venue:status', _onVenueStatusUpdate)
      : null;
  if (typeof unsub === 'function') _unsubscribers.push(unsub);

  // Auto-refresh data periodically
  _refreshInterval = setInterval(() => {
    _renderContent();
  }, REFRESH_INTERVAL_MS);
}

/**
 * Destroys the Venue Operations module, cleaning up all resources.
 */
export function destroy() {
  _unsubscribers.forEach((unsub) => {
    if (typeof unsub === 'function') unsub();
  });
  _unsubscribers = [];

  if (_refreshInterval) {
    clearInterval(_refreshInterval);
    _refreshInterval = null;
  }

  if (_container) {
    clearElement(_container);
  }

  _container = null;
  _contentArea = null;
  _selectedVenueId = 'lusail';
}
