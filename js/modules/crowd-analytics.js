/**
 * @module crowd-analytics
 * @description Intelligent Crowd Management — Real-time analytics, zone density
 * monitoring, flow-history charting, and predictive insights for the FIFA World
 * Cup 2026 Smart Stadium application.
 *
 * Key features:
 * - Per-venue crowd analytics with KPIs
 * - Interactive zone density grid with trend arrows and colour coding
 * - Canvas-based animated line chart for crowd flow history
 * - Predictive AI insights cards
 * - Real-time updates via EventBus subscriptions
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
   Module-level state
   ────────────────────────────────────────────── */

/** @type {HTMLElement|null} */
let _container = null;

/** @type {string} Currently selected venue name */
let _selectedVenue = 'MetLife Stadium';

/** @type {Function[]} EventBus unsubscribe callbacks */
const _subscriptions = [];

/** @type {number|null} Interval for simulated data push */
let _dataInterval = null;

/** @type {ResizeObserver|null} Canvas resize observer */
let _resizeObserver = null;

/** @type {number|null} Current animation frame id for chart drawing */
let _chartAnimFrame = null;

/** @type {Array<{time: string, value: number}>} Flow history data points */
let _flowData = [];

/** @type {HTMLCanvasElement|null} Reference to the chart canvas */
let _canvas = null;

/** @type {CanvasRenderingContext2D|null} */
let _ctx = null;

/** @type {number} Maximum data points to keep */
const MAX_DATA_POINTS = 20;

/* ──────────────────────────────────────────────
   Simulated venue & zone data
   ────────────────────────────────────────────── */

/**
 * @typedef {Object} VenueData
 * @property {string} name
 * @property {number} capacity
 * @property {number} current
 * @property {number} entryRate - people per minute
 * @property {string} predictedPeakTime
 * @property {number} predictedPeakCount
 * @property {Array<ZoneData>} zones
 */

/**
 * @typedef {Object} ZoneData
 * @property {string} name
 * @property {number} current
 * @property {number} max
 * @property {string} trend - 'rising' | 'falling' | 'stable'
 */

/**
 * Returns venue-specific analytics data.
 * @param {string} venueName - Name of the venue
 * @returns {VenueData} Complete venue analytics data
 */
function _getVenueData(venueName) {
  /** @type {Object<string, VenueData>} */
  const venues = {
    'MetLife Stadium': {
      name: 'MetLife Stadium',
      capacity: 82500,
      current: 78200 + Math.floor(Math.random() * 800 - 400),
      entryRate: 142 + Math.floor(Math.random() * 30 - 15),
      predictedPeakTime: '19:45',
      predictedPeakCount: 81200,
      zones: [
        { name: 'Zone A — North Stand', current: 12400, max: 14000, trend: 'stable' },
        { name: 'Zone B — East Stand', current: 13100, max: 14200, trend: 'rising' },
        { name: 'Zone C — South Stand', current: 11800, max: 14000, trend: 'falling' },
        { name: 'Zone D — West Stand', current: 12900, max: 14200, trend: 'rising' },
        { name: 'Zone E — Upper North', current: 9800, max: 10500, trend: 'stable' },
        { name: 'Zone F — Upper South', current: 8200, max: 10500, trend: 'falling' },
        { name: 'Zone G — VIP Suites', current: 4800, max: 5100, trend: 'stable' },
        { name: 'Zone H — Concourse', current: 5100, max: 8000, trend: 'rising' },
      ],
    },
    'AT&T Stadium': {
      name: 'AT&T Stadium',
      capacity: 80000,
      current: 71500 + Math.floor(Math.random() * 600 - 300),
      entryRate: 118 + Math.floor(Math.random() * 20 - 10),
      predictedPeakTime: '20:15',
      predictedPeakCount: 78800,
      zones: [
        { name: 'Zone A — Lower Bowl N', current: 11200, max: 13000, trend: 'rising' },
        { name: 'Zone B — Lower Bowl S', current: 10800, max: 13000, trend: 'stable' },
        { name: 'Zone C — Club Level', current: 8500, max: 9200, trend: 'stable' },
        { name: 'Zone D — Upper Deck N', current: 12400, max: 14500, trend: 'rising' },
        { name: 'Zone E — Upper Deck S', current: 11600, max: 14500, trend: 'falling' },
        { name: 'Zone F — End Zone E', current: 8900, max: 9500, trend: 'rising' },
        { name: 'Zone G — End Zone W', current: 5100, max: 9500, trend: 'falling' },
        { name: 'Zone H — Concourse', current: 3000, max: 7000, trend: 'stable' },
      ],
    },
    'SoFi Stadium': {
      name: 'SoFi Stadium',
      capacity: 70240,
      current: 62100 + Math.floor(Math.random() * 500 - 250),
      entryRate: 95 + Math.floor(Math.random() * 15 - 7),
      predictedPeakTime: '18:30',
      predictedPeakCount: 68500,
      zones: [
        { name: 'Zone A — North', current: 10200, max: 11800, trend: 'rising' },
        { name: 'Zone B — East', current: 11500, max: 12000, trend: 'rising' },
        { name: 'Zone C — South', current: 9800, max: 11800, trend: 'stable' },
        { name: 'Zone D — West', current: 10400, max: 12000, trend: 'falling' },
        { name: 'Zone E — Premium', current: 7600, max: 8200, trend: 'stable' },
        { name: 'Zone F — Concourse', current: 4200, max: 7000, trend: 'rising' },
        { name: 'Zone G — Media', current: 3400, max: 3800, trend: 'stable' },
        { name: 'Zone H — Operations', current: 4900, max: 5600, trend: 'stable' },
      ],
    },
    'Hard Rock Stadium': {
      name: 'Hard Rock Stadium',
      capacity: 65326,
      current: 42800 + Math.floor(Math.random() * 400 - 200),
      entryRate: 210 + Math.floor(Math.random() * 40 - 20),
      predictedPeakTime: '19:00',
      predictedPeakCount: 63100,
      zones: [
        { name: 'Zone A — Lower North', current: 7200, max: 10500, trend: 'rising' },
        { name: 'Zone B — Lower South', current: 6800, max: 10500, trend: 'rising' },
        { name: 'Zone C — Upper North', current: 8100, max: 11000, trend: 'rising' },
        { name: 'Zone D — Upper South', current: 7500, max: 11000, trend: 'stable' },
        { name: 'Zone E — Club Level', current: 5400, max: 6800, trend: 'rising' },
        { name: 'Zone F — Suite Level', current: 3600, max: 4500, trend: 'stable' },
        { name: 'Zone G — Concourse', current: 4200, max: 8000, trend: 'rising' },
      ],
    },
    'Estadio Azteca': {
      name: 'Estadio Azteca',
      capacity: 87523,
      current: 81400 + Math.floor(Math.random() * 900 - 450),
      entryRate: 65 + Math.floor(Math.random() * 20 - 10),
      predictedPeakTime: '20:00',
      predictedPeakCount: 85900,
      zones: [
        { name: 'Zone A — Tribuna Norte', current: 14200, max: 15000, trend: 'stable' },
        { name: 'Zone B — Tribuna Sur', current: 13800, max: 15000, trend: 'rising' },
        { name: 'Zone C — Cabecera Este', current: 12500, max: 13200, trend: 'stable' },
        { name: 'Zone D — Cabecera Oeste', current: 12100, max: 13200, trend: 'falling' },
        { name: 'Zone E — Palcos', current: 8800, max: 9500, trend: 'stable' },
        { name: 'Zone F — General Norte', current: 10200, max: 11000, trend: 'rising' },
        { name: 'Zone G — General Sur', current: 9800, max: 10600, trend: 'stable' },
      ],
    },
    'Lumen Field': {
      name: 'Lumen Field',
      capacity: 69000,
      current: 58300 + Math.floor(Math.random() * 500 - 250),
      entryRate: 130 + Math.floor(Math.random() * 25 - 12),
      predictedPeakTime: '19:30',
      predictedPeakCount: 67200,
      zones: [
        { name: 'Zone A — North End', current: 9500, max: 11500, trend: 'rising' },
        { name: 'Zone B — South End', current: 9200, max: 11500, trend: 'stable' },
        { name: 'Zone C — East Sideline', current: 10800, max: 12000, trend: 'rising' },
        { name: 'Zone D — West Sideline', current: 10200, max: 12000, trend: 'stable' },
        { name: 'Zone E — Upper Bowl', current: 11600, max: 13000, trend: 'falling' },
        { name: 'Zone F — Club', current: 4200, max: 5000, trend: 'stable' },
        { name: 'Zone G — Concourse', current: 2800, max: 6000, trend: 'rising' },
      ],
    },
  };

  return venues[venueName] || venues['MetLife Stadium'];
}

/**
 * Returns all available venue names.
 * @returns {string[]}
 */
function _getVenueNames() {
  return [
    'MetLife Stadium',
    'AT&T Stadium',
    'SoFi Stadium',
    'Hard Rock Stadium',
    'Estadio Azteca',
    'Lumen Field',
  ];
}

/**
 * Returns crowd-related alerts for the selected venue.
 * @param {string} venueName
 * @returns {Array<Object>}
 */
function _getCrowdAlerts(venueName) {
  const now = Date.now();
  const allAlerts = [
    { severity: 'critical', title: 'Zone B Overcrowding', message: `Zone B at ${venueName} exceeding 92% capacity. Crowd control measures needed.`, timestamp: now - 180000 },
    { severity: 'warning', title: 'Entry Gate Congestion', message: `Gate 3 experiencing 20+ minute queues. Consider opening auxiliary entry.`, timestamp: now - 420000 },
    { severity: 'info', title: 'Flow Optimised', message: `Crowd flow redistribution between Zone C and Zone D successful.`, timestamp: now - 900000 },
    { severity: 'warning', title: 'Concourse Bottleneck', message: `Level 2 concourse near Section 210 showing reduced flow rate.`, timestamp: now - 1500000 },
  ];
  return allAlerts;
}

/**
 * Returns predictive insight cards.
 * @param {string} venueName
 * @returns {Array<Object>}
 */
function _getPredictions(venueName) {
  const data = _getVenueData(venueName);
  return [
    {
      icon: '📈',
      title: 'Peak Crowd Forecast',
      message: `Peak crowd expected at ${data.predictedPeakTime} — recommend opening Gate 5 and Gate 6 to accommodate ${formatNumber(data.predictedPeakCount)} spectators.`,
      severity: 'warning',
    },
    {
      icon: '🚨',
      title: 'Zone Capacity Alert',
      message: `Zone B reaching 90% capacity — suggest redirecting incoming flow to Zone D (currently at ${formatPercentage(data.zones.find((z) => z.name.includes('D'))?.current / data.zones.find((z) => z.name.includes('D'))?.max || 0.7)}).`,
      severity: 'error',
    },
    {
      icon: '🚪',
      title: 'Exit Strategy',
      message: `Exit congestion predicted at full-time — stagger departure announcements by zone with 3-minute intervals to reduce bottlenecks.`,
      severity: 'info',
    },
    {
      icon: '🔄',
      title: 'Half-time Flow',
      message: `Half-time concession rush in 12 minutes — pre-position additional staff at Concourse Level 2 food court.`,
      severity: 'warning',
    },
  ];
}

/**
 * Initialises the flow-data array with historical simulated data points.
 */
function _initFlowData() {
  _flowData = [];
  const now = new Date();
  const venueData = _getVenueData(_selectedVenue);
  const baseValue = venueData.current;

  for (let i = MAX_DATA_POINTS - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    const variance = Math.floor(Math.random() * 4000 - 2000);
    // Simulate a gradual increase with noise
    const growth = Math.floor(((MAX_DATA_POINTS - i) / MAX_DATA_POINTS) * 5000);
    _flowData.push({
      time: formatTime(t),
      value: Math.max(0, baseValue - 5000 + growth + variance),
    });
  }
}

/* ──────────────────────────────────────────────
   Canvas chart implementation
   ────────────────────────────────────────────── */

/**
 * Device-pixel-ratio-aware canvas sizing.
 * @param {HTMLCanvasElement} canvas
 * @param {number} width - CSS pixel width
 * @param {number} height - CSS pixel height
 */
function _setCanvasSize(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Draws the complete flow-history line chart on the canvas.
 * Uses quadratic bezier curves for smooth lines and a gradient fill.
 *
 * @param {number} [animationProgress=1] - 0 to 1, controls how much of the
 *   chart is drawn (for the initial left-to-right animation)
 */
function _drawChart(animationProgress = 1) {
  if (!_canvas || !_ctx) return;

  const ctx = _ctx;
  const w = parseFloat(_canvas.style.width);
  const h = parseFloat(_canvas.style.height);

  if (w <= 0 || h <= 0) return;

  // Clear
  ctx.clearRect(0, 0, w, h);

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  if (chartW <= 0 || chartH <= 0) return;

  const data = _flowData;
  if (data.length < 2) return;

  // Calculate y range
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  /**
   * Converts a data index to canvas x coordinate.
   * @param {number} i
   * @returns {number}
   */
  const xPos = (i) => padding.left + (i / (data.length - 1)) * chartW;

  /**
   * Converts a data value to canvas y coordinate.
   * @param {number} v
   * @returns {number}
   */
  const yPos = (v) => padding.top + chartH - ((v - minVal) / range) * chartH;

  // — Grid lines —
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    // Y-axis label
    const val = maxVal - (i / gridLines) * range;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatCompactNumber(Math.round(val)), padding.left - 8, y);
  }

  // — X-axis labels —
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += labelStep) {
    ctx.fillText(data[i].time, xPos(i), h - padding.bottom + 8);
  }
  // Always show last label
  if ((data.length - 1) % labelStep !== 0) {
    ctx.fillText(data[data.length - 1].time, xPos(data.length - 1), h - padding.bottom + 8);
  }

  // Determine how many points to draw based on animation progress
  const pointsToShow = Math.max(2, Math.ceil(data.length * animationProgress));

  // — Gradient fill under line —
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');   // accent-secondary at 0.3 alpha
  gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.1)');
  gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].value));

  // Draw smooth bezier line for the fill path
  for (let i = 1; i < pointsToShow; i++) {
    const prevX = xPos(i - 1);
    const prevY = yPos(data[i - 1].value);
    const currX = xPos(i);
    const currY = yPos(data[i].value);
    const cpX = (prevX + currX) / 2;
    ctx.quadraticCurveTo(prevX + (currX - prevX) * 0.5, prevY, cpX, (prevY + currY) / 2);
    if (i === pointsToShow - 1) {
      ctx.quadraticCurveTo(cpX, (prevY + currY) / 2, currX, currY);
    }
  }

  // Close path for fill
  const lastIdx = pointsToShow - 1;
  ctx.lineTo(xPos(lastIdx), h - padding.bottom);
  ctx.lineTo(xPos(0), h - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // — Main line —
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].value));

  for (let i = 1; i < pointsToShow; i++) {
    const prevX = xPos(i - 1);
    const prevY = yPos(data[i - 1].value);
    const currX = xPos(i);
    const currY = yPos(data[i].value);
    const cpX = (prevX + currX) / 2;
    ctx.quadraticCurveTo(prevX + (currX - prevX) * 0.5, prevY, cpX, (prevY + currY) / 2);
    if (i === pointsToShow - 1) {
      ctx.quadraticCurveTo(cpX, (prevY + currY) / 2, currX, currY);
    }
  }

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // — Data points —
  for (let i = 0; i < pointsToShow; i++) {
    const x = xPos(i);
    const y = yPos(data[i].value);

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i === pointsToShow - 1 ? '#06b6d4' : 'rgba(6, 182, 212, 0.7)';
    ctx.fill();
  }
}

/**
 * Runs the initial chart drawing animation (left-to-right reveal).
 */
function _animateChartIn() {
  const duration = 1200;
  const startTime = performance.now();

  /** @param {number} time */
  function step(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    _drawChart(eased);

    if (progress < 1) {
      _chartAnimFrame = requestAnimationFrame(step);
    } else {
      _chartAnimFrame = null;
    }
  }

  _chartAnimFrame = requestAnimationFrame(step);
}

/* ──────────────────────────────────────────────
   Section builders
   ────────────────────────────────────────────── */

/**
 * Builds the page header with title and venue selector dropdown.
 * @returns {HTMLElement}
 */
function _buildHeader() {
  const header = createElement('header', { className: 'page-header' });

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = 'Crowd Analytics';

  const select = createElement('select', { id: 'ca-venue-select', className: 'search-input' });
  select.setAttribute('aria-label', 'Select venue');
  select.style.cssText = 'max-width:260px;cursor:pointer;';

  _getVenueNames().forEach((name) => {
    const option = createElement('option');
    option.value = name;
    option.textContent = Security.escapeHTML(name);
    if (name === _selectedVenue) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', (e) => {
    _selectedVenue = e.target.value;
    _handleVenueChange();
  });

  appendChildren(header, [title, select]);
  return header;
}

/**
 * Builds the KPI row for the selected venue.
 * @returns {HTMLElement}
 */
function _buildKpiRow() {
  const data = _getVenueData(_selectedVenue);
  const utilisation = data.current / data.capacity;

  const utilisationClass =
    utilisation > 0.85 ? 'text-error' : utilisation > 0.6 ? 'text-warning' : 'text-success';

  const grid = createElement('div', { className: 'grid-4 content-section', id: 'ca-kpi-row' });

  /** @type {Array<Object>} */
  const kpis = [
    { icon: '👥', label: 'Current Attendance', value: formatNumber(data.current), id: 'ca-kpi-attendance' },
    { icon: '📊', label: 'Capacity Utilisation', value: formatPercentage(utilisation), id: 'ca-kpi-utilisation', colorClass: utilisationClass },
    { icon: '🚶', label: 'Entry Rate', value: `${data.entryRate}/min`, id: 'ca-kpi-entry-rate' },
    { icon: '🔮', label: 'Predicted Peak', value: `${data.predictedPeakTime} · ${formatCompactNumber(data.predictedPeakCount)}`, id: 'ca-kpi-peak' },
  ];

  kpis.forEach((kpi, i) => {
    const card = createElement('div', { className: 'kpi-card animate-in' });
    card.style.setProperty('--delay', `${i * 0.05}s`);

    const iconEl = createElement('span', { className: 'kpi-icon' });
    iconEl.textContent = kpi.icon;

    const valueEl = createElement('span', {
      className: `kpi-value${kpi.colorClass ? ' ' + kpi.colorClass : ''}`,
      id: kpi.id,
    });
    valueEl.textContent = kpi.value;

    const labelEl = createElement('span', { className: 'kpi-label' });
    labelEl.textContent = kpi.label;

    appendChildren(card, [iconEl, valueEl, labelEl]);
    grid.appendChild(card);
  });

  return grid;
}

/**
 * Builds a single zone density row.
 * @param {ZoneData} zone
 * @returns {HTMLElement}
 */
function _buildZoneRow(zone) {
  const pct = Math.round((zone.current / zone.max) * 100);
  const row = createElement('div', { className: 'animate-in' });
  row.style.cssText = 'margin-bottom:0.75rem;';

  // Header line: zone name + trend arrow + percentage
  const headerLine = createElement('div');
  headerLine.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;';

  const nameWrap = createElement('div');
  nameWrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;';

  const nameEl = createElement('span');
  nameEl.style.fontSize = '0.85rem';
  nameEl.textContent = Security.escapeHTML(zone.name);

  const trendArrow = createElement('span');
  if (zone.trend === 'rising') {
    trendArrow.textContent = '↑';
    trendArrow.className = 'text-error';
  } else if (zone.trend === 'falling') {
    trendArrow.textContent = '↓';
    trendArrow.className = 'text-success';
  } else {
    trendArrow.textContent = '→';
    trendArrow.className = 'text-muted';
  }
  trendArrow.style.fontWeight = '700';
  trendArrow.title = zone.trend;

  appendChildren(nameWrap, [nameEl, trendArrow]);

  const counts = createElement('span', { className: 'text-muted' });
  counts.style.fontSize = '0.8rem';
  counts.textContent = `${formatNumber(zone.current)} / ${formatNumber(zone.max)}`;

  appendChildren(headerLine, [nameWrap, counts]);

  // Progress bar
  const bar = createElement('div', { className: 'progress-bar' });
  const fill = createElement('div', { className: 'progress-fill' });
  fill.style.width = `${pct}%`;
  fill.style.transition = 'width 0.5s ease';
  if (pct > 85) {
    fill.style.backgroundColor = 'var(--color-error, #ef4444)';
  } else if (pct > 60) {
    fill.style.backgroundColor = 'var(--color-warning, #f59e0b)';
  } else {
    fill.style.backgroundColor = 'var(--color-success, #22c55e)';
  }
  bar.appendChild(fill);

  // Percentage label
  const pctEl = createElement('div');
  pctEl.style.cssText = 'text-align:right;font-size:0.75rem;margin-top:0.15rem;';
  pctEl.className = pct > 85 ? 'text-error' : pct > 60 ? 'text-warning' : 'text-success';
  pctEl.textContent = `${pct}%`;

  appendChildren(row, [headerLine, bar, pctEl]);
  return row;
}

/**
 * Builds the "Zone Density" panel (left column).
 * @returns {HTMLElement}
 */
function _buildZoneDensityPanel() {
  const card = createElement('div', { className: 'card animate-in', id: 'ca-zone-density' });
  card.style.setProperty('--delay', '0.15s');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Zone Density';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });
  const data = _getVenueData(_selectedVenue);

  data.zones.forEach((zone, i) => {
    const row = _buildZoneRow(zone);
    row.style.setProperty('--delay', `${0.2 + i * 0.04}s`);
    body.appendChild(row);
  });

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the "Flow History" chart panel (right column).
 * @returns {HTMLElement}
 */
function _buildFlowHistoryPanel() {
  const card = createElement('div', { className: 'card animate-in', id: 'ca-flow-chart' });
  card.style.setProperty('--delay', '0.2s');

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Flow History';
  header.appendChild(title);

  const body = createElement('div', { className: 'card-body' });
  body.style.position = 'relative';

  _canvas = createElement('canvas');
  _canvas.setAttribute('role', 'img');
  _canvas.setAttribute(
    'aria-label',
    `Crowd flow line chart showing attendance over the last ${MAX_DATA_POINTS} minutes for ${Security.escapeHTML(_selectedVenue)}. Current attendance approximately ${formatNumber(_flowData[_flowData.length - 1]?.value || 0)}.`
  );
  _canvas.style.cssText = 'width:100%;height:280px;display:block;';

  body.appendChild(_canvas);
  appendChildren(card, [header, body]);

  return card;
}

/**
 * Builds the "Crowd Alerts" section.
 * @returns {HTMLElement}
 */
function _buildCrowdAlertsSection() {
  const section = createElement('section', { className: 'content-section', id: 'ca-crowd-alerts' });

  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Crowd Alerts';
  title.style.marginBottom = '1rem';
  section.appendChild(title);

  const alerts = _getCrowdAlerts(_selectedVenue);

  if (alerts.length === 0) {
    const empty = createElement('p', { className: 'text-muted' });
    empty.textContent = 'No active crowd alerts for this venue.';
    section.appendChild(empty);
  } else {
    alerts.forEach((alert, i) => {
      const severityClass =
        alert.severity === 'critical'
          ? 'alert--critical'
          : alert.severity === 'warning'
            ? 'alert--warning'
            : 'alert--info';

      const item = createElement('div', { className: `alert-item ${severityClass} animate-in` });
      item.style.setProperty('--delay', `${0.3 + i * 0.04}s`);

      const contentWrap = createElement('div');
      contentWrap.style.flex = '1';

      const titleEl = createElement('strong');
      titleEl.textContent = Security.escapeHTML(alert.title);

      const msgEl = createElement('p', { className: 'text-secondary' });
      msgEl.textContent = Security.escapeHTML(alert.message);
      msgEl.style.margin = '0.25rem 0';

      const timeEl = createElement('small', { className: 'text-muted' });
      timeEl.textContent = timeAgo(alert.timestamp);

      appendChildren(contentWrap, [titleEl, msgEl, timeEl]);
      item.appendChild(contentWrap);
      section.appendChild(item);
    });
  }

  return section;
}

/**
 * Builds a single prediction insight card.
 * @param {Object} prediction
 * @returns {HTMLElement}
 */
function _buildPredictionCard(prediction) {
  const severityBadgeClass =
    prediction.severity === 'error'
      ? 'badge--error'
      : prediction.severity === 'warning'
        ? 'badge--warning'
        : 'badge--info';

  const card = createElement('div', { className: 'card animate-in' });

  const header = createElement('div', { className: 'card-header' });
  const icon = createElement('span');
  icon.textContent = prediction.icon;
  icon.style.fontSize = '1.5rem';

  const titleEl = createElement('h3', { className: 'card-title' });
  titleEl.textContent = Security.escapeHTML(prediction.title);
  titleEl.style.fontSize = '0.95rem';

  const badge = createElement('span', { className: `badge ${severityBadgeClass}` });
  badge.textContent = prediction.severity === 'error' ? 'High' : prediction.severity === 'warning' ? 'Medium' : 'Low';

  appendChildren(header, [icon, titleEl, badge]);

  const body = createElement('div', { className: 'card-body' });
  const msg = createElement('p', { className: 'text-secondary' });
  msg.textContent = Security.escapeHTML(prediction.message);
  msg.style.fontSize = '0.85rem';
  body.appendChild(msg);

  appendChildren(card, [header, body]);
  return card;
}

/**
 * Builds the "Predictive Insights" section.
 * @returns {HTMLElement}
 */
function _buildPredictionsSection() {
  const section = createElement('section', { className: 'content-section', id: 'ca-predictions' });

  const titleRow = createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;';

  const title = createElement('h2', { className: 'card-title' });
  title.textContent = 'Predictive Insights';

  const aiBadge = createElement('span', { className: 'badge badge--info' });
  aiBadge.textContent = 'AI Powered';

  appendChildren(titleRow, [title, aiBadge]);
  section.appendChild(titleRow);

  const grid = createElement('div', { className: 'grid-2' });
  const predictions = _getPredictions(_selectedVenue);

  predictions.forEach((p, i) => {
    const card = _buildPredictionCard(p);
    card.style.setProperty('--delay', `${0.35 + i * 0.06}s`);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

/* ──────────────────────────────────────────────
   Venue change & live updates
   ────────────────────────────────────────────── */

/**
 * Handles venue selection change — re-renders all data sections.
 */
function _handleVenueChange() {
  _initFlowData();
  _renderContent();
  announceToScreenReader(`Showing analytics for ${_selectedVenue}`);
}

/**
 * Re-renders all content sections (everything except the header).
 */
function _renderContent() {
  const contentArea = $('#ca-content-area');
  if (!contentArea) return;

  // Cancel any running chart animation
  if (_chartAnimFrame !== null) {
    cancelAnimationFrame(_chartAnimFrame);
    _chartAnimFrame = null;
  }

  // Disconnect old resize observer
  if (_resizeObserver) {
    _resizeObserver.disconnect();
    _resizeObserver = null;
  }

  clearElement(contentArea);

  // KPI row
  contentArea.appendChild(_buildKpiRow());

  // Two-column: zone density + flow chart
  const twoCol = createElement('div', { className: 'grid-2 content-section' });
  twoCol.appendChild(_buildZoneDensityPanel());
  twoCol.appendChild(_buildFlowHistoryPanel());
  contentArea.appendChild(twoCol);

  // Divider
  contentArea.appendChild(createElement('hr', { className: 'divider' }));

  // Crowd alerts
  contentArea.appendChild(_buildCrowdAlertsSection());

  // Divider
  contentArea.appendChild(createElement('hr', { className: 'divider' }));

  // Predictive insights
  contentArea.appendChild(_buildPredictionsSection());

  // Initialise canvas chart
  _initChart();
}

/**
 * Initialises the canvas chart — sizing, resize observer, and initial animation.
 */
function _initChart() {
  if (!_canvas) return;

  _ctx = _canvas.getContext('2d');
  if (!_ctx) return;

  // Size the canvas to its container
  const parent = _canvas.parentElement;
  if (parent) {
    const rect = parent.getBoundingClientRect();
    _setCanvasSize(_canvas, rect.width, 280);
  }

  // ResizeObserver for responsive resizing
  _resizeObserver = new ResizeObserver(
    debounce((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (_canvas && width > 0) {
          _setCanvasSize(_canvas, width, 280);
          _drawChart(1);
        }
      }
    }, 150)
  );

  if (parent) {
    _resizeObserver.observe(parent);
  }

  // Animate chart in
  _animateChartIn();
}

/**
 * Handles crowd:update events — refreshes zone density, KPIs, and adds
 * a new data point to the chart.
 * @param {Object} data - Event payload
 */
function _onCrowdUpdate(data) {
  const venueData = _getVenueData(_selectedVenue);

  // Update KPIs
  const attendanceEl = $('#ca-kpi-attendance');
  if (attendanceEl) attendanceEl.textContent = formatNumber(venueData.current);

  const utilisation = venueData.current / venueData.capacity;
  const utilisationEl = $('#ca-kpi-utilisation');
  if (utilisationEl) {
    utilisationEl.textContent = formatPercentage(utilisation);
    utilisationEl.className = `kpi-value ${
      utilisation > 0.85 ? 'text-error' : utilisation > 0.6 ? 'text-warning' : 'text-success'
    }`;
  }

  const entryEl = $('#ca-kpi-entry-rate');
  if (entryEl) entryEl.textContent = `${venueData.entryRate}/min`;

  // Update zone density
  const zoneBody = $('#ca-zone-density .card-body');
  if (zoneBody) {
    clearElement(zoneBody);
    venueData.zones.forEach((zone) => zoneBody.appendChild(_buildZoneRow(zone)));
  }

  // Add new data point to chart
  const now = new Date();
  _flowData.push({
    time: formatTime(now),
    value: venueData.current,
  });
  if (_flowData.length > MAX_DATA_POINTS) {
    _flowData.shift();
  }

  // Update chart accessibility label
  if (_canvas) {
    _canvas.setAttribute(
      'aria-label',
      `Crowd flow line chart for ${Security.escapeHTML(_selectedVenue)}. Latest attendance: ${formatNumber(venueData.current)}.`
    );
  }

  // Redraw chart
  _drawChart(1);
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Initialises the Crowd Analytics module, rendering all sections into the
 * provided container element.
 *
 * @param {HTMLElement} container - The DOM element to render into
 */
export function init(container) {
  _container = container;
  clearElement(_container);

  _initFlowData();

  // Header (with venue selector)
  _container.appendChild(_buildHeader());

  // Content area (re-rendered on venue change)
  const contentArea = createElement('div', { id: 'ca-content-area' });
  _container.appendChild(contentArea);

  _renderContent();

  // Subscribe to live events
  _subscriptions.push(EventBus.on('crowd:update', _onCrowdUpdate));

  // Simulated data push every 5 seconds
  _dataInterval = setInterval(() => {
    _onCrowdUpdate({});
  }, 5000);

  announceToScreenReader('Crowd Analytics loaded');
}

/**
 * Destroys the Crowd Analytics module — cleans up all intervals,
 * subscriptions, observers, animation frames, and DOM references.
 */
export function destroy() {
  // Cancel chart animation
  if (_chartAnimFrame !== null) {
    cancelAnimationFrame(_chartAnimFrame);
    _chartAnimFrame = null;
  }

  // Disconnect resize observer
  if (_resizeObserver) {
    _resizeObserver.disconnect();
    _resizeObserver = null;
  }

  // Clear data interval
  if (_dataInterval !== null) {
    clearInterval(_dataInterval);
    _dataInterval = null;
  }

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

  // Reset state
  _canvas = null;
  _ctx = null;
  _flowData = [];
}
