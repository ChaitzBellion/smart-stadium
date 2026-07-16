/**
 * @module match-center
 * @description Tournament Operations Hub — Match schedule, group standings,
 * and venue information for the FIFA World Cup 2026 Smart Stadium app.
 *
 * Features:
 * - Filterable match schedule (All / Live / Upcoming / Completed)
 * - Group filter chips (All Groups, A–H)
 * - Group standings tables with sortable columns
 * - Venue cards with capacity gauges
 * - Live-match auto-updates via EventBus
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

/** @type {string} Current active tab: 'schedule' | 'standings' | 'venues' */
let _activeTab = 'schedule';

/** @type {string} Current status filter: 'all' | 'live' | 'upcoming' | 'completed' */
let _statusFilter = 'all';

/** @type {string} Current group filter: 'all' | 'A'..'H' */
let _groupFilter = 'all';

/** @type {Function[]} EventBus unsubscribe callbacks */
const _subscriptions = [];

/** @type {Object<string, {column: string, ascending: boolean}>} Sort state per group */
const _sortState = {};

/* ──────────────────────────────────────────────
   Simulated tournament data
   ────────────────────────────────────────────── */

/** @type {string[]} Group labels */
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function _getMatches() {
  const dsMatches = DataService.getMatches();
  return dsMatches.map(m => {
    // Convert string date/time to a timestamp number
    let timestamp = Date.now();
    if (m.date && m.time) {
      timestamp = new Date(`${m.date}T${m.time}:00Z`).getTime();
    }
    
    // Resolve venue name from venueId
    const venueObj = DataService.getVenue(m.venueId);
    const venueName = venueObj ? venueObj.name : 'Unknown Venue';

    // Format team names with flags if available (flag could be an image URL now, so handle gracefully)
    // If flag is an HTTP URL (from API-Sports), just use the name, or use an image tag.
    // The UI currently escapes HTML, so we just use the name.
    const homeTeamStr = String(m.homeTeam.flag).startsWith('http') ? m.homeTeam.name : `${m.homeTeam.flag} ${m.homeTeam.name}`;
    const awayTeamStr = String(m.awayTeam.flag).startsWith('http') ? m.awayTeam.name : `${m.awayTeam.flag} ${m.awayTeam.name}`;

    return {
      id: m.id,
      group: m.groupId,
      homeTeam: homeTeamStr,
      awayTeam: awayTeamStr,
      homeScore: m.score.home,
      awayScore: m.score.away,
      status: m.status,
      minute: m.minute,
      venue: venueName,
      date: timestamp,
      events: m.events || []
    };
  });
}

/**
 * Returns group standings computed from match results.
 * @returns {Object<string, Array<Object>>} Map of group letter → sorted team standings
 */
function _getStandings() {
  const matches = _getMatches().filter((m) => m.status === 'completed');
  /** @type {Object<string, Object>} */
  const teams = {};

  /**
   * Extracts the team name without the flag emoji prefix.
   * @param {string} raw - e.g. "🇺🇸 United States"
   * @returns {string} Full string as-is (we keep flag for display)
   */
  const key = (raw) => raw;

  /**
   * Ensures a team entry exists.
   * @param {string} name - Full team name with flag
   * @param {string} group - Group letter
   */
  const ensure = (name, group) => {
    if (!teams[name]) {
      teams[name] = { team: name, group, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    }
  };

  matches.forEach((m) => {
    ensure(m.homeTeam, m.group);
    ensure(m.awayTeam, m.group);

    const home = teams[m.homeTeam];
    const away = teams[m.awayTeam];

    home.p++;
    away.p++;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.w++;
      home.pts += 3;
      away.l++;
    } else if (m.homeScore < m.awayScore) {
      away.w++;
      away.pts += 3;
      home.l++;
    } else {
      home.d++;
      away.d++;
      home.pts += 1;
      away.pts += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  });

  // Also add teams from upcoming / live matches that may not have completed results
  _getMatches().forEach((m) => {
    ensure(m.homeTeam, m.group);
    ensure(m.awayTeam, m.group);
  });

  /** @type {Object<string, Array<Object>>} */
  const grouped = {};
  GROUPS.forEach((g) => (grouped[g] = []));
  Object.values(teams).forEach((t) => {
    if (grouped[t.group]) grouped[t.group].push(t);
  });

  // Default sort: pts desc, gd desc, gf desc
  Object.keys(grouped).forEach((g) => {
    grouped[g].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  });

  return grouped;
}

/**
 * Returns venue data.
 * @returns {Array<Object>} Venue objects
 */
function _getVenues() {
  return [
    { name: 'MetLife Stadium', city: 'East Rutherford', country: '🇺🇸', capacity: 82500, matchesHosted: 8 },
    { name: 'AT&T Stadium', city: 'Arlington', country: '🇺🇸', capacity: 80000, matchesHosted: 7 },
    { name: 'SoFi Stadium', city: 'Inglewood', country: '🇺🇸', capacity: 70240, matchesHosted: 7 },
    { name: 'Hard Rock Stadium', city: 'Miami Gardens', country: '🇺🇸', capacity: 65326, matchesHosted: 6 },
    { name: 'Lumen Field', city: 'Seattle', country: '🇺🇸', capacity: 69000, matchesHosted: 5 },
    { name: 'NRG Stadium', city: 'Houston', country: '🇺🇸', capacity: 72220, matchesHosted: 5 },
    { name: 'Lincoln Financial Field', city: 'Philadelphia', country: '🇺🇸', capacity: 69176, matchesHosted: 5 },
    { name: 'Arrowhead Stadium', city: 'Kansas City', country: '🇺🇸', capacity: 76416, matchesHosted: 4 },
    { name: 'BMO Field', city: 'Toronto', country: '🇨🇦', capacity: 45500, matchesHosted: 4 },
    { name: 'Estadio Azteca', city: 'Mexico City', country: '🇲🇽', capacity: 87523, matchesHosted: 6 },
    { name: 'Estadio BBVA', city: 'Monterrey', country: '🇲🇽', capacity: 53500, matchesHosted: 4 },
    { name: 'Estadio Akron', city: 'Guadalajara', country: '🇲🇽', capacity: 49850, matchesHosted: 4 },
  ];
}

/* ──────────────────────────────────────────────
   Section builders
   ────────────────────────────────────────────── */

/**
 * Builds the page header with title and status filter chips.
 * @returns {HTMLElement}
 */
function _buildHeader() {
  const header = createElement('header', { className: 'page-header' });

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = 'Match Center';

  const chips = createElement('div');
  chips.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Live', value: 'live' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Completed', value: 'completed' },
  ];

  filters.forEach((f) => {
    const chip = createElement('button', {
      className: `chip${_statusFilter === f.value ? ' chip--active' : ''}`,
    });
    chip.textContent = f.label;
    chip.dataset.filter = f.value;
    chip.setAttribute('aria-pressed', String(_statusFilter === f.value));
    chip.addEventListener('click', () => _handleStatusFilter(f.value));
    chips.appendChild(chip);
  });

  appendChildren(header, [title, chips]);
  return header;
}

/**
 * Builds the tab bar for Schedule / Standings / Venues.
 * @returns {HTMLElement}
 */
function _buildTabBar() {
  const bar = createElement('nav', { className: 'tab-bar', role: 'tablist' });

  const tabs = [
    { label: 'Schedule', value: 'schedule' },
    { label: 'Group Standings', value: 'standings' },
    { label: 'Venues', value: 'venues' },
  ];

  tabs.forEach((t) => {
    const tab = createElement('button', {
      className: `tab${_activeTab === t.value ? ' tab--active' : ''}`,
      role: 'tab',
    });
    tab.textContent = t.label;
    tab.dataset.tab = t.value;
    tab.setAttribute('aria-selected', String(_activeTab === t.value));
    tab.addEventListener('click', () => _handleTabSwitch(t.value));
    bar.appendChild(tab);
  });

  return bar;
}

/**
 * Builds group filter chips for the schedule tab.
 * @returns {HTMLElement}
 */
function _buildGroupFilterChips() {
  const wrap = createElement('div', { id: 'mc-group-chips' });
  wrap.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;';

  const allChip = createElement('button', {
    className: `chip${_groupFilter === 'all' ? ' chip--active' : ''}`,
  });
  allChip.textContent = 'All Groups';
  allChip.dataset.group = 'all';
  allChip.addEventListener('click', () => _handleGroupFilter('all'));
  wrap.appendChild(allChip);

  GROUPS.forEach((g) => {
    const chip = createElement('button', {
      className: `chip${_groupFilter === g ? ' chip--active' : ''}`,
    });
    chip.textContent = `Group ${g}`;
    chip.dataset.group = g;
    chip.addEventListener('click', () => _handleGroupFilter(g));
    wrap.appendChild(chip);
  });

  return wrap;
}

/**
 * Sorts matches: live first, then upcoming by date, then completed by date desc.
 * @param {Array<Object>} matches
 * @returns {Array<Object>}
 */
function _sortMatches(matches) {
  const order = { live: 0, upcoming: 1, completed: 2 };
  return [...matches].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'upcoming') return a.date - b.date;
    if (a.status === 'completed') return b.date - a.date;
    return 0;
  });
}

/**
 * Builds a single match card.
 * @param {Object} match - Match data
 * @returns {HTMLElement}
 */
function _buildScheduleMatchCard(match) {
  const card = createElement('div', { className: 'match-card animate-in' });
  card.dataset.matchId = match.id;
  card.dataset.status = match.status;
  card.dataset.group = match.group;
  card.style.cursor = 'pointer';

  // Group badge
  const groupBadge = createElement('span', { className: 'badge badge--info' });
  groupBadge.textContent = `Group ${match.group}`;

  // Status badge
  const statusBadge = createElement('span');
  if (match.status === 'live') {
    statusBadge.className = 'badge badge--error match-status--live';
    const dot = createElement('span', { className: 'status-dot status-dot--online' });
    statusBadge.appendChild(dot);
    const minText = document.createTextNode(` ${match.minute}'`);
    statusBadge.appendChild(minText);
  } else if (match.status === 'upcoming') {
    statusBadge.className = 'badge badge--warning';
    const matchDate = new Date(match.date);
    const diffMs = match.date - Date.now();
    if (diffMs < 86400000) {
      statusBadge.textContent = `In ${Math.round(diffMs / 3600000)}h`;
    } else {
      statusBadge.textContent = formatDateTime(matchDate);
    }
  } else {
    statusBadge.className = 'badge badge--success';
    statusBadge.textContent = 'FT';
  }

  const badgeRow = createElement('div');
  badgeRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;';
  appendChildren(badgeRow, [groupBadge, statusBadge]);

  // Home team row
  const homeRow = createElement('div', { className: 'team-row' });
  const homeName = createElement('span');
  homeName.textContent = Security.escapeHTML(match.homeTeam);
  if (match.status !== 'upcoming' && match.homeScore > match.awayScore) {
    homeName.style.fontWeight = '700';
  }
  const homeScore = createElement('strong');
  homeScore.textContent = match.status === 'upcoming' ? '-' : String(match.homeScore);
  if (match.homeScore > match.awayScore) homeScore.classList.add('text-accent');
  appendChildren(homeRow, [homeName, homeScore]);

  // Away team row
  const awayRow = createElement('div', { className: 'team-row' });
  const awayName = createElement('span');
  awayName.textContent = Security.escapeHTML(match.awayTeam);
  if (match.status !== 'upcoming' && match.awayScore > match.homeScore) {
    awayName.style.fontWeight = '700';
  }
  const awayScore = createElement('strong');
  awayScore.textContent = match.status === 'upcoming' ? '-' : String(match.awayScore);
  if (match.awayScore > match.homeScore) awayScore.classList.add('text-accent');
  appendChildren(awayRow, [awayName, awayScore]);

  // Venue and date
  const infoRow = createElement('div', { className: 'text-muted' });
  infoRow.style.cssText = 'font-size:0.8rem;margin-top:0.5rem;';
  infoRow.textContent = `${Security.escapeHTML(match.venue)} · ${formatDateTime(new Date(match.date))}`;

  appendChildren(card, [badgeRow, homeRow, awayRow, infoRow]);

  // Events feed for live matches
  if (match.status === 'live' && match.events && match.events.length > 0) {
    const divider = createElement('hr', { className: 'divider' });
    card.appendChild(divider);
    const eventsWrap = createElement('div');
    eventsWrap.style.cssText = 'font-size:0.8rem;';
    match.events.forEach((ev) => {
      const evLine = createElement('div', { className: 'text-secondary' });
      evLine.style.cssText = 'padding:0.15rem 0;';
      evLine.textContent = `⚽ ${Security.escapeHTML(ev.player)} ${ev.minute}'`;
      eventsWrap.appendChild(evLine);
    });
    card.appendChild(eventsWrap);
  }

  // Click to expand/show details
  card.addEventListener('click', () => _handleMatchClick(match, card));

  return card;
}

/**
 * Handles clicking a match card — toggles inline detail expansion.
 * @param {Object} match - Match data
 * @param {HTMLElement} card - The card element
 */
function _handleMatchClick(match, card) {
  const existingDetail = card.querySelector('[data-detail]');
  if (existingDetail) {
    existingDetail.remove();
    return;
  }

  const detail = createElement('div');
  detail.dataset.detail = 'true';
  detail.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.1);font-size:0.8rem;';

  const detailTitle = createElement('strong', { className: 'text-accent' });
  detailTitle.textContent = 'Match Details';

  const detailVenue = createElement('div', { className: 'text-secondary' });
  detailVenue.textContent = `Venue: ${Security.escapeHTML(match.venue)}`;

  const detailGroup = createElement('div', { className: 'text-secondary' });
  detailGroup.textContent = `Group: ${match.group}`;

  const detailStatus = createElement('div', { className: 'text-secondary' });
  detailStatus.textContent = `Status: ${match.status === 'live' ? `Live — ${match.minute}'` : match.status === 'completed' ? 'Full Time' : 'Upcoming'}`;

  appendChildren(detail, [detailTitle, detailVenue, detailGroup, detailStatus]);

  if (match.events && match.events.length > 0) {
    const evTitle = createElement('strong');
    evTitle.textContent = 'Events:';
    evTitle.style.display = 'block';
    evTitle.style.marginTop = '0.5rem';
    detail.appendChild(evTitle);

    match.events.forEach((ev) => {
      const evLine = createElement('div', { className: 'text-secondary' });
      evLine.textContent = `⚽ ${ev.minute}' — ${Security.escapeHTML(ev.player)} (${ev.team === 'home' ? Security.escapeHTML(match.homeTeam) : Security.escapeHTML(match.awayTeam)})`;
      detail.appendChild(evLine);
    });
  }

  card.appendChild(detail);
  console.log('Match detail expanded:', match.id, match);
}

/**
 * Builds the Schedule tab content.
 * @returns {HTMLElement}
 */
function _buildScheduleTab() {
  const panel = createElement('div', { id: 'mc-panel-schedule', role: 'tabpanel' });
  panel.style.display = _activeTab === 'schedule' ? 'block' : 'none';

  panel.appendChild(_buildGroupFilterChips());

  const grid = createElement('div', { className: 'grid-auto', id: 'mc-match-grid' });

  let matches = _getMatches();

  // Apply status filter
  if (_statusFilter !== 'all') {
    matches = matches.filter((m) => m.status === _statusFilter);
  }

  // Apply group filter
  if (_groupFilter !== 'all') {
    matches = matches.filter((m) => m.group === _groupFilter);
  }

  const sorted = _sortMatches(matches);
  sorted.forEach((m, i) => {
    const card = _buildScheduleMatchCard(m);
    card.style.setProperty('--delay', `${i * 0.04}s`);
    grid.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = createElement('p', { className: 'text-muted' });
    empty.textContent = 'No matches found for the selected filters.';
    grid.appendChild(empty);
  }

  panel.appendChild(grid);
  return panel;
}

/**
 * Builds a sortable group standings table.
 * @param {string} group - Group letter
 * @param {Array<Object>} teams - Team standing objects
 * @returns {HTMLElement}
 */
function _buildGroupTable(group, teams) {
  const card = createElement('div', { className: 'card animate-in' });

  const header = createElement('div', { className: 'card-header' });
  const title = createElement('h3', { className: 'card-title' });
  title.textContent = `Group ${group}`;
  header.appendChild(title);

  const tableContainer = createElement('div', { className: 'table-container' });
  const table = createElement('table');
  table.id = `mc-table-${group}`;

  // Table head
  const thead = createElement('thead');
  const headRow = createElement('tr');
  const columns = [
    { key: 'team', label: 'Team' },
    { key: 'p', label: 'P' },
    { key: 'w', label: 'W' },
    { key: 'd', label: 'D' },
    { key: 'l', label: 'L' },
    { key: 'gf', label: 'GF' },
    { key: 'ga', label: 'GA' },
    { key: 'gd', label: 'GD' },
    { key: 'pts', label: 'Pts' },
  ];

  columns.forEach((col) => {
    const th = createElement('th');
    th.textContent = col.label;
    th.style.cursor = 'pointer';
    th.title = `Sort by ${col.label}`;
    th.addEventListener('click', () => _handleColumnSort(group, col.key));
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Table body
  const tbody = createElement('tbody');
  const sortState = _sortState[group];
  let sortedTeams = [...teams];
  if (sortState) {
    sortedTeams.sort((a, b) => {
      const av = a[sortState.column];
      const bv = b[sortState.column];
      if (typeof av === 'string') {
        return sortState.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortState.ascending ? av - bv : bv - av;
    });
  }

  sortedTeams.forEach((team, idx) => {
    const tr = createElement('tr');
    // Highlight top 2 (qualified positions)
    if (idx < 2) {
      tr.style.backgroundColor = 'rgba(var(--accent-rgb, 99,102,241), 0.08)';
    }

    columns.forEach((col) => {
      const td = createElement('td');
      if (col.key === 'team') {
        td.textContent = Security.escapeHTML(team.team);
        td.style.fontWeight = '500';
      } else if (col.key === 'pts') {
        td.textContent = String(team[col.key]);
        td.style.fontWeight = '700';
        td.classList.add('text-accent');
      } else {
        td.textContent = String(team[col.key]);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  appendChildren(table, [thead, tbody]);
  tableContainer.appendChild(table);
  appendChildren(card, [header, tableContainer]);
  return card;
}

/**
 * Builds the Group Standings tab content.
 * @returns {HTMLElement}
 */
function _buildStandingsTab() {
  const panel = createElement('div', { id: 'mc-panel-standings', role: 'tabpanel' });
  panel.style.display = _activeTab === 'standings' ? 'block' : 'none';

  const grid = createElement('div', { className: 'grid-2' });
  const standings = _getStandings();

  GROUPS.forEach((g, i) => {
    const table = _buildGroupTable(g, standings[g]);
    table.style.setProperty('--delay', `${i * 0.06}s`);
    grid.appendChild(table);
  });

  panel.appendChild(grid);
  return panel;
}

/**
 * Builds a mini capacity gauge (SVG-free, CSS-based arc simulation using progress bar).
 * @param {number} capacity - Venue capacity
 * @returns {HTMLElement}
 */
function _buildCapacityGauge(capacity) {
  const wrap = createElement('div');
  wrap.style.cssText = 'text-align:center;margin-top:0.5rem;';
  const bar = createElement('div', { className: 'progress-bar' });
  bar.style.height = '6px';
  const fill = createElement('div', { className: 'progress-fill' });
  // Show as percentage of max capacity (87523 Estadio Azteca)
  const pct = Math.round((capacity / 87523) * 100);
  fill.style.width = `${pct}%`;
  fill.style.backgroundColor = 'var(--color-accent-secondary, #06b6d4)';
  bar.appendChild(fill);

  const label = createElement('div', { className: 'text-muted' });
  label.style.fontSize = '0.75rem';
  label.textContent = `${formatNumber(capacity)} seats`;

  appendChildren(wrap, [bar, label]);
  return wrap;
}

/**
 * Builds a single venue card.
 * @param {Object} venue - Venue data
 * @returns {HTMLElement}
 */
function _buildVenueCard(venue) {
  const card = createElement('div', { className: 'venue-card card animate-in' });

  const name = createElement('h3', { className: 'card-title' });
  name.textContent = Security.escapeHTML(venue.name);
  name.style.fontSize = '1rem';

  const location = createElement('div', { className: 'text-secondary' });
  location.textContent = `${Security.escapeHTML(venue.city)} ${venue.country}`;
  location.style.fontSize = '0.85rem';

  const matchCount = createElement('div', { className: 'text-muted' });
  matchCount.style.cssText = 'font-size:0.8rem;margin-top:0.5rem;';
  matchCount.textContent = `${venue.matchesHosted} matches hosted`;

  const gauge = _buildCapacityGauge(venue.capacity);

  appendChildren(card, [name, location, matchCount, gauge]);
  return card;
}

/**
 * Builds the Venues tab content.
 * @returns {HTMLElement}
 */
function _buildVenuesTab() {
  const panel = createElement('div', { id: 'mc-panel-venues', role: 'tabpanel' });
  panel.style.display = _activeTab === 'venues' ? 'block' : 'none';

  const grid = createElement('div', { className: 'grid-3' });
  const venues = _getVenues();

  venues.forEach((v, i) => {
    const card = _buildVenueCard(v);
    card.style.setProperty('--delay', `${i * 0.05}s`);
    grid.appendChild(card);
  });

  panel.appendChild(grid);
  return panel;
}

/* ──────────────────────────────────────────────
   Interaction handlers
   ────────────────────────────────────────────── */

/**
 * Handles status-filter chip clicks. Uses data-attribute toggling to avoid
 * full re-render when possible.
 * @param {string} value - Filter value
 */
function _handleStatusFilter(value) {
  _statusFilter = value;

  // Update chip active states
  const chips = $$('[data-filter]');
  if (chips) {
    chips.forEach((c) => {
      const isActive = c.dataset.filter === value;
      c.className = `chip${isActive ? ' chip--active' : ''}`;
      c.setAttribute('aria-pressed', String(isActive));
    });
  }

  // Re-render match grid only
  _refreshMatchGrid();
  announceToScreenReader(`Filtering by ${value === 'all' ? 'all matches' : value}`);
}

/**
 * Handles group-filter chip clicks.
 * @param {string} value - Group letter or 'all'
 */
function _handleGroupFilter(value) {
  _groupFilter = value;

  const chips = $$('[data-group]');
  if (chips) {
    chips.forEach((c) => {
      const isActive = c.dataset.group === value;
      c.className = `chip${isActive ? ' chip--active' : ''}`;
    });
  }

  _refreshMatchGrid();
  announceToScreenReader(`Showing ${value === 'all' ? 'all groups' : 'Group ' + value}`);
}

/**
 * Refreshes only the match card grid without re-building the whole tab.
 */
function _refreshMatchGrid() {
  const grid = $('#mc-match-grid');
  if (!grid) return;

  clearElement(grid);

  let matches = _getMatches();
  if (_statusFilter !== 'all') {
    matches = matches.filter((m) => m.status === _statusFilter);
  }
  if (_groupFilter !== 'all') {
    matches = matches.filter((m) => m.group === _groupFilter);
  }

  const sorted = _sortMatches(matches);
  sorted.forEach((m, i) => {
    const card = _buildScheduleMatchCard(m);
    card.style.setProperty('--delay', `${i * 0.04}s`);
    grid.appendChild(card);
  });

  if (sorted.length === 0) {
    const empty = createElement('p', { className: 'text-muted' });
    empty.textContent = 'No matches found for the selected filters.';
    grid.appendChild(empty);
  }
}

/**
 * Handles tab switching.
 * @param {string} tabValue - Tab to switch to
 */
function _handleTabSwitch(tabValue) {
  _activeTab = tabValue;

  // Update tab active states
  const tabs = $$('[data-tab]');
  if (tabs) {
    tabs.forEach((t) => {
      const isActive = t.dataset.tab === tabValue;
      t.className = `tab${isActive ? ' tab--active' : ''}`;
      t.setAttribute('aria-selected', String(isActive));
    });
  }

  // Toggle panel visibility
  ['schedule', 'standings', 'venues'].forEach((panel) => {
    const el = $(`#mc-panel-${panel}`);
    if (el) {
      el.style.display = panel === tabValue ? 'block' : 'none';
    }
  });

  announceToScreenReader(`Switched to ${tabValue} tab`);
}

/**
 * Handles column header click for sorting a group table.
 * @param {string} group - Group letter
 * @param {string} column - Column key to sort by
 */
function _handleColumnSort(group, column) {
  const current = _sortState[group];
  if (current && current.column === column) {
    _sortState[group] = { column, ascending: !current.ascending };
  } else {
    _sortState[group] = { column, ascending: column === 'team' };
  }

  // Re-render just this group's table body
  const table = $(`#mc-table-${group}`);
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  clearElement(tbody);

  const standings = _getStandings();
  let teams = [...standings[group]];
  const state = _sortState[group];

  teams.sort((a, b) => {
    const av = a[state.column];
    const bv = b[state.column];
    if (typeof av === 'string') {
      return state.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return state.ascending ? av - bv : bv - av;
  });

  const columns = ['team', 'p', 'w', 'd', 'l', 'gf', 'ga', 'gd', 'pts'];
  teams.forEach((team, idx) => {
    const tr = createElement('tr');
    if (idx < 2) {
      tr.style.backgroundColor = 'rgba(var(--accent-rgb, 99,102,241), 0.08)';
    }
    columns.forEach((col) => {
      const td = createElement('td');
      if (col === 'team') {
        td.textContent = Security.escapeHTML(team.team);
        td.style.fontWeight = '500';
      } else if (col === 'pts') {
        td.textContent = String(team[col]);
        td.style.fontWeight = '700';
        td.classList.add('text-accent');
      } else {
        td.textContent = String(team[col]);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/**
 * Handles match:update events for live match refresh.
 * @param {Object} data - Event payload
 */
function _onMatchUpdate(data) {
  if (_activeTab === 'schedule') {
    _refreshMatchGrid();
  }
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

/**
 * Initialises the Match Center module, rendering the tabbed interface into
 * the provided container element.
 *
 * @param {HTMLElement} container - The DOM element to render into
 */
export function init(container) {
  _container = container;
  _activeTab = 'schedule';
  _statusFilter = 'all';
  _groupFilter = 'all';
  clearElement(_container);

  const header = _buildHeader();
  const tabBar = _buildTabBar();

  const content = createElement('div', { className: 'content-section' });
  content.appendChild(_buildScheduleTab());
  content.appendChild(_buildStandingsTab());
  content.appendChild(_buildVenuesTab());

  appendChildren(_container, [header, tabBar, content]);

  // Subscribe to live events
  _subscriptions.push(EventBus.on('match:update', _onMatchUpdate));

  announceToScreenReader('Match Center loaded');
}

/**
 * Destroys the Match Center module — cleans up subscriptions and DOM references.
 */
export function destroy() {
  _subscriptions.forEach((unsub) => {
    if (typeof unsub === 'function') unsub();
  });
  _subscriptions.length = 0;

  // Reset sort state
  Object.keys(_sortState).forEach((k) => delete _sortState[k]);

  if (_container) {
    clearElement(_container);
    _container = null;
  }
}
