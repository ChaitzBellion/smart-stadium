/**
 * @fileoverview FIFA World Cup 2026 Smart Stadium Data Service
 *
 * Provides all match data, venue information, crowd analytics,
 * operational alerts, food/concession data, and a real-time live
 * simulation engine that drives the entire application.
 *
 * @module services/data-service
 */

import { EventBus } from './event-bus.js';
import { StateManager } from './state-manager.js';
import { Security } from './security.js';

/* ================================================================
   STATIC DATA — VENUES
   ================================================================ */

/**
 * @typedef {Object} VenueFacilities
 * @property {number} gates      – Number of entry gates
 * @property {number} concessions – Number of concession stands
 * @property {number} medical    – Number of medical stations
 * @property {number} security   – Number of security checkpoints
 * @property {number} restrooms  – Number of restroom blocks
 */

/**
 * @typedef {Object} Venue
 * @property {string}  id        – Unique venue identifier
 * @property {string}  name      – Official venue name
 * @property {string}  city      – Host city
 * @property {string}  country   – Host country
 * @property {number}  capacity  – Maximum seating capacity
 * @property {number}  lat       – Latitude
 * @property {number}  lng       – Longitude
 * @property {string}  timezone  – IANA timezone string
 * @property {VenueFacilities} facilities
 */

/** @type {Venue[]} All 16 official FIFA World Cup 2026 venues */
const VENUES = [
  { id: 'v01', name: 'MetLife Stadium', city: 'East Rutherford, NJ', country: 'USA', capacity: 82500, lat: 40.8128, lng: -74.0742, timezone: 'America/New_York', facilities: { gates: 8, concessions: 45, medical: 4, security: 12, restrooms: 60 } },
  { id: 'v02', name: 'AT&T Stadium', city: 'Arlington, TX', country: 'USA', capacity: 80000, lat: 32.7473, lng: -97.0945, timezone: 'America/Chicago', facilities: { gates: 6, concessions: 40, medical: 3, security: 10, restrooms: 55 } },
  { id: 'v03', name: 'Hard Rock Stadium', city: 'Miami, FL', country: 'USA', capacity: 65326, lat: 25.958, lng: -80.2389, timezone: 'America/New_York', facilities: { gates: 6, concessions: 35, medical: 3, security: 10, restrooms: 48 } },
  { id: 'v04', name: 'SoFi Stadium', city: 'Inglewood, CA', country: 'USA', capacity: 70240, lat: 33.9535, lng: -118.3392, timezone: 'America/Los_Angeles', facilities: { gates: 7, concessions: 42, medical: 4, security: 11, restrooms: 52 } },
  { id: 'v05', name: 'Lincoln Financial Field', city: 'Philadelphia, PA', country: 'USA', capacity: 69796, lat: 39.9008, lng: -75.1675, timezone: 'America/New_York', facilities: { gates: 6, concessions: 38, medical: 3, security: 10, restrooms: 50 } },
  { id: 'v06', name: 'NRG Stadium', city: 'Houston, TX', country: 'USA', capacity: 72220, lat: 29.6847, lng: -95.4107, timezone: 'America/Chicago', facilities: { gates: 6, concessions: 36, medical: 3, security: 10, restrooms: 48 } },
  { id: 'v07', name: 'Mercedes-Benz Stadium', city: 'Atlanta, GA', country: 'USA', capacity: 71000, lat: 33.7554, lng: -84.4005, timezone: 'America/New_York', facilities: { gates: 7, concessions: 40, medical: 3, security: 11, restrooms: 52 } },
  { id: 'v08', name: 'Lumen Field', city: 'Seattle, WA', country: 'USA', capacity: 69000, lat: 47.5952, lng: -122.3316, timezone: 'America/Los_Angeles', facilities: { gates: 6, concessions: 35, medical: 3, security: 10, restrooms: 46 } },
  { id: 'v09', name: 'Gillette Stadium', city: 'Foxborough, MA', country: 'USA', capacity: 65878, lat: 42.0909, lng: -71.2643, timezone: 'America/New_York', facilities: { gates: 5, concessions: 34, medical: 3, security: 9, restrooms: 44 } },
  { id: 'v10', name: 'Arrowhead Stadium', city: 'Kansas City, MO', country: 'USA', capacity: 76416, lat: 39.0489, lng: -94.484, timezone: 'America/Chicago', facilities: { gates: 6, concessions: 38, medical: 3, security: 10, restrooms: 50 } },
  { id: 'v11', name: "Levi's Stadium", city: 'Santa Clara, CA', country: 'USA', capacity: 68500, lat: 37.4033, lng: -121.9694, timezone: 'America/Los_Angeles', facilities: { gates: 6, concessions: 36, medical: 3, security: 10, restrooms: 47 } },
  { id: 'v12', name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', capacity: 87523, lat: 19.3029, lng: -99.1505, timezone: 'America/Mexico_City', facilities: { gates: 9, concessions: 50, medical: 5, security: 14, restrooms: 65 } },
  { id: 'v13', name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico', capacity: 53500, lat: 25.6721, lng: -100.2446, timezone: 'America/Monterrey', facilities: { gates: 5, concessions: 30, medical: 3, security: 8, restrooms: 38 } },
  { id: 'v14', name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico', capacity: 49850, lat: 20.6821, lng: -103.4627, timezone: 'America/Mexico_City', facilities: { gates: 5, concessions: 28, medical: 3, security: 8, restrooms: 36 } },
  { id: 'v15', name: 'BMO Field', city: 'Toronto', country: 'Canada', capacity: 30000, lat: 43.6332, lng: -79.4186, timezone: 'America/Toronto', facilities: { gates: 4, concessions: 20, medical: 2, security: 6, restrooms: 24 } },
  { id: 'v16', name: 'BC Place', city: 'Vancouver', country: 'Canada', capacity: 54500, lat: 49.2768, lng: -123.112, timezone: 'America/Vancouver', facilities: { gates: 5, concessions: 30, medical: 3, security: 8, restrooms: 38 } }
];

/* ================================================================
   STATIC DATA — TEAMS & GROUPS
   ================================================================ */

/**
 * @typedef {Object} Team
 * @property {string} name – Full team name
 * @property {string} code – FIFA three-letter code
 * @property {string} flag – Flag emoji
 */

/**
 * Group definitions with 4 teams each, using real/likely qualified nations.
 * @type {Record<string, Team[]>}
 */
const GROUPS = {
  A: [
    { name: 'USA', code: 'USA', flag: '🇺🇸' },
    { name: 'Netherlands', code: 'NED', flag: '🇳🇱' },
    { name: 'Senegal', code: 'SEN', flag: '🇸🇳' },
    { name: 'Chile', code: 'CHI', flag: '🇨🇱' }
  ],
  B: [
    { name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Japan', code: 'JPN', flag: '🇯🇵' },
    { name: 'Serbia', code: 'SRB', flag: '🇷🇸' },
    { name: 'Costa Rica', code: 'CRC', flag: '🇨🇷' }
  ],
  C: [
    { name: 'Argentina', code: 'ARG', flag: '🇦🇷' },
    { name: 'Mexico', code: 'MEX', flag: '🇲🇽' },
    { name: 'Poland', code: 'POL', flag: '🇵🇱' },
    { name: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦' }
  ],
  D: [
    { name: 'France', code: 'FRA', flag: '🇫🇷' },
    { name: 'Denmark', code: 'DEN', flag: '🇩🇰' },
    { name: 'Australia', code: 'AUS', flag: '🇦🇺' },
    { name: 'Tunisia', code: 'TUN', flag: '🇹🇳' }
  ],
  E: [
    { name: 'Brazil', code: 'BRA', flag: '🇧🇷' },
    { name: 'Germany', code: 'GER', flag: '🇩🇪' },
    { name: 'Canada', code: 'CAN', flag: '🇨🇦' },
    { name: 'Cameroon', code: 'CMR', flag: '🇨🇲' }
  ],
  F: [
    { name: 'Spain', code: 'ESP', flag: '🇪🇸' },
    { name: 'Croatia', code: 'CRO', flag: '🇭🇷' },
    { name: 'Morocco', code: 'MAR', flag: '🇲🇦' },
    { name: 'South Korea', code: 'KOR', flag: '🇰🇷' }
  ],
  G: [
    { name: 'Portugal', code: 'POR', flag: '🇵🇹' },
    { name: 'Uruguay', code: 'URU', flag: '🇺🇾' },
    { name: 'Nigeria', code: 'NGA', flag: '🇳🇬' },
    { name: 'Iran', code: 'IRN', flag: '🇮🇷' }
  ],
  H: [
    { name: 'Belgium', code: 'BEL', flag: '🇧🇪' },
    { name: 'Colombia', code: 'COL', flag: '🇨🇴' },
    { name: 'Egypt', code: 'EGY', flag: '🇪🇬' },
    { name: 'Ecuador', code: 'ECU', flag: '🇪🇨' }
  ]
};

/* ================================================================
   STATIC DATA — MATCHES (24 group-stage fixtures)
   ================================================================ */

/**
 * @typedef {Object} MatchEvent
 * @property {string}  player – Scorer name
 * @property {number}  minute – Minute of the goal
 * @property {string}  team   – Team code
 * @property {'goal'|'own_goal'|'penalty'} type
 */

/**
 * @typedef {Object} Match
 * @property {string}  id
 * @property {string}  groupId
 * @property {Team}    homeTeam
 * @property {Team}    awayTeam
 * @property {string}  venueId
 * @property {string}  date       – ISO date string (YYYY-MM-DD)
 * @property {string}  time       – Local kick-off time (HH:MM)
 * @property {'completed'|'live'|'upcoming'} status
 * @property {{home: number, away: number}} score
 * @property {number|null}   minute     – Current match minute (live only)
 * @property {MatchEvent[]}  events
 */

/** @type {Match[]} */
const MATCHES = [
  // ── Group A ─────────────────────────────────────────────
  {
    id: 'm01', groupId: 'A',
    homeTeam: { name: 'USA', code: 'USA', flag: '🇺🇸' },
    awayTeam: { name: 'Chile', code: 'CHI', flag: '🇨🇱' },
    venueId: 'v01', date: '2026-06-11', time: '17:00',
    status: 'completed', score: { home: 2, away: 0 }, minute: 90,
    events: [
      { player: 'C. Pulisic', minute: 23, team: 'USA', type: 'goal' },
      { player: 'W. McKennie', minute: 67, team: 'USA', type: 'goal' }
    ]
  },
  {
    id: 'm02', groupId: 'A',
    homeTeam: { name: 'Netherlands', code: 'NED', flag: '🇳🇱' },
    awayTeam: { name: 'Senegal', code: 'SEN', flag: '🇸🇳' },
    venueId: 'v04', date: '2026-06-11', time: '20:00',
    status: 'completed', score: { home: 1, away: 1 }, minute: 90,
    events: [
      { player: 'C. Gakpo', minute: 34, team: 'NED', type: 'goal' },
      { player: 'S. Mané', minute: 58, team: 'SEN', type: 'goal' }
    ]
  },
  {
    id: 'm03', groupId: 'A',
    homeTeam: { name: 'USA', code: 'USA', flag: '🇺🇸' },
    awayTeam: { name: 'Netherlands', code: 'NED', flag: '🇳🇱' },
    venueId: 'v01', date: '2026-06-15', time: '18:00',
    status: 'live', score: { home: 1, away: 1 }, minute: 62,
    events: [
      { player: 'M. Depay', minute: 12, team: 'NED', type: 'goal' },
      { player: 'T. Weah', minute: 41, team: 'USA', type: 'goal' }
    ]
  },
  // ── Group B ─────────────────────────────────────────────
  {
    id: 'm04', groupId: 'B',
    homeTeam: { name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    awayTeam: { name: 'Serbia', code: 'SRB', flag: '🇷🇸' },
    venueId: 'v07', date: '2026-06-12', time: '15:00',
    status: 'completed', score: { home: 3, away: 1 }, minute: 90,
    events: [
      { player: 'J. Bellingham', minute: 14, team: 'ENG', type: 'goal' },
      { player: 'B. Saka', minute: 37, team: 'ENG', type: 'goal' },
      { player: 'D. Vlahović', minute: 52, team: 'SRB', type: 'goal' },
      { player: 'H. Kane', minute: 78, team: 'ENG', type: 'goal' }
    ]
  },
  {
    id: 'm05', groupId: 'B',
    homeTeam: { name: 'Japan', code: 'JPN', flag: '🇯🇵' },
    awayTeam: { name: 'Costa Rica', code: 'CRC', flag: '🇨🇷' },
    venueId: 'v08', date: '2026-06-12', time: '18:00',
    status: 'completed', score: { home: 2, away: 0 }, minute: 90,
    events: [
      { player: 'T. Kubo', minute: 29, team: 'JPN', type: 'goal' },
      { player: 'K. Mitoma', minute: 73, team: 'JPN', type: 'goal' }
    ]
  },
  {
    id: 'm06', groupId: 'B',
    homeTeam: { name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    awayTeam: { name: 'Japan', code: 'JPN', flag: '🇯🇵' },
    venueId: 'v05', date: '2026-06-16', time: '20:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  },
  // ── Group C ─────────────────────────────────────────────
  {
    id: 'm07', groupId: 'C',
    homeTeam: { name: 'Argentina', code: 'ARG', flag: '🇦🇷' },
    awayTeam: { name: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦' },
    venueId: 'v12', date: '2026-06-13', time: '13:00',
    status: 'completed', score: { home: 3, away: 0 }, minute: 90,
    events: [
      { player: 'L. Messi', minute: 10, team: 'ARG', type: 'penalty' },
      { player: 'J. Álvarez', minute: 48, team: 'ARG', type: 'goal' },
      { player: 'L. Messi', minute: 71, team: 'ARG', type: 'goal' }
    ]
  },
  {
    id: 'm08', groupId: 'C',
    homeTeam: { name: 'Mexico', code: 'MEX', flag: '🇲🇽' },
    awayTeam: { name: 'Poland', code: 'POL', flag: '🇵🇱' },
    venueId: 'v12', date: '2026-06-13', time: '16:00',
    status: 'completed', score: { home: 0, away: 0 }, minute: 90,
    events: []
  },
  {
    id: 'm09', groupId: 'C',
    homeTeam: { name: 'Argentina', code: 'ARG', flag: '🇦🇷' },
    awayTeam: { name: 'Mexico', code: 'MEX', flag: '🇲🇽' },
    venueId: 'v02', date: '2026-06-17', time: '19:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  },
  // ── Group D ─────────────────────────────────────────────
  {
    id: 'm10', groupId: 'D',
    homeTeam: { name: 'France', code: 'FRA', flag: '🇫🇷' },
    awayTeam: { name: 'Tunisia', code: 'TUN', flag: '🇹🇳' },
    venueId: 'v03', date: '2026-06-14', time: '14:00',
    status: 'completed', score: { home: 2, away: 1 }, minute: 90,
    events: [
      { player: 'K. Mbappé', minute: 22, team: 'FRA', type: 'goal' },
      { player: 'W. Khazri', minute: 55, team: 'TUN', type: 'goal' },
      { player: 'A. Griezmann', minute: 82, team: 'FRA', type: 'goal' }
    ]
  },
  {
    id: 'm11', groupId: 'D',
    homeTeam: { name: 'Denmark', code: 'DEN', flag: '🇩🇰' },
    awayTeam: { name: 'Australia', code: 'AUS', flag: '🇦🇺' },
    venueId: 'v06', date: '2026-06-14', time: '17:00',
    status: 'completed', score: { home: 1, away: 0 }, minute: 90,
    events: [
      { player: 'C. Eriksen', minute: 63, team: 'DEN', type: 'goal' }
    ]
  },
  {
    id: 'm12', groupId: 'D',
    homeTeam: { name: 'France', code: 'FRA', flag: '🇫🇷' },
    awayTeam: { name: 'Denmark', code: 'DEN', flag: '🇩🇰' },
    venueId: 'v01', date: '2026-06-18', time: '18:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  },
  // ── Group E ─────────────────────────────────────────────
  {
    id: 'm13', groupId: 'E',
    homeTeam: { name: 'Brazil', code: 'BRA', flag: '🇧🇷' },
    awayTeam: { name: 'Cameroon', code: 'CMR', flag: '🇨🇲' },
    venueId: 'v04', date: '2026-06-15', time: '14:00',
    status: 'completed', score: { home: 4, away: 1 }, minute: 90,
    events: [
      { player: 'Vinícius Jr.', minute: 8, team: 'BRA', type: 'goal' },
      { player: 'Rodrygo', minute: 31, team: 'BRA', type: 'goal' },
      { player: 'V. Aboubakar', minute: 44, team: 'CMR', type: 'goal' },
      { player: 'Vinícius Jr.', minute: 59, team: 'BRA', type: 'goal' },
      { player: 'Raphinha', minute: 87, team: 'BRA', type: 'goal' }
    ]
  },
  {
    id: 'm14', groupId: 'E',
    homeTeam: { name: 'Germany', code: 'GER', flag: '🇩🇪' },
    awayTeam: { name: 'Canada', code: 'CAN', flag: '🇨🇦' },
    venueId: 'v15', date: '2026-06-15', time: '17:00',
    status: 'live', score: { home: 2, away: 1 }, minute: 74,
    events: [
      { player: 'F. Wirtz', minute: 15, team: 'GER', type: 'goal' },
      { player: 'A. Davies', minute: 33, team: 'CAN', type: 'goal' },
      { player: 'J. Musiala', minute: 56, team: 'GER', type: 'goal' }
    ]
  },
  {
    id: 'm15', groupId: 'E',
    homeTeam: { name: 'Brazil', code: 'BRA', flag: '🇧🇷' },
    awayTeam: { name: 'Germany', code: 'GER', flag: '🇩🇪' },
    venueId: 'v07', date: '2026-06-19', time: '20:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  },
  // ── Group F ─────────────────────────────────────────────
  {
    id: 'm16', groupId: 'F',
    homeTeam: { name: 'Spain', code: 'ESP', flag: '🇪🇸' },
    awayTeam: { name: 'South Korea', code: 'KOR', flag: '🇰🇷' },
    venueId: 'v10', date: '2026-06-14', time: '20:00',
    status: 'completed', score: { home: 3, away: 0 }, minute: 90,
    events: [
      { player: 'L. Yamal', minute: 19, team: 'ESP', type: 'goal' },
      { player: 'P. Gavira', minute: 42, team: 'ESP', type: 'goal' },
      { player: 'N. Williams', minute: 76, team: 'ESP', type: 'goal' }
    ]
  },
  {
    id: 'm17', groupId: 'F',
    homeTeam: { name: 'Croatia', code: 'CRO', flag: '🇭🇷' },
    awayTeam: { name: 'Morocco', code: 'MAR', flag: '🇲🇦' },
    venueId: 'v09', date: '2026-06-14', time: '17:00',
    status: 'completed', score: { home: 0, away: 0 }, minute: 90,
    events: []
  },
  {
    id: 'm18', groupId: 'F',
    homeTeam: { name: 'Spain', code: 'ESP', flag: '🇪🇸' },
    awayTeam: { name: 'Croatia', code: 'CRO', flag: '🇭🇷' },
    venueId: 'v06', date: '2026-06-18', time: '15:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  },
  // ── Group G ─────────────────────────────────────────────
  {
    id: 'm19', groupId: 'G',
    homeTeam: { name: 'Portugal', code: 'POR', flag: '🇵🇹' },
    awayTeam: { name: 'Iran', code: 'IRN', flag: '🇮🇷' },
    venueId: 'v11', date: '2026-06-13', time: '20:00',
    status: 'completed', score: { home: 2, away: 0 }, minute: 90,
    events: [
      { player: 'C. Ronaldo', minute: 39, team: 'POR', type: 'penalty' },
      { player: 'B. Silva', minute: 68, team: 'POR', type: 'goal' }
    ]
  },
  {
    id: 'm20', groupId: 'G',
    homeTeam: { name: 'Uruguay', code: 'URU', flag: '🇺🇾' },
    awayTeam: { name: 'Nigeria', code: 'NGA', flag: '🇳🇬' },
    venueId: 'v13', date: '2026-06-13', time: '17:00',
    status: 'completed', score: { home: 1, away: 1 }, minute: 90,
    events: [
      { player: 'D. Núñez', minute: 27, team: 'URU', type: 'goal' },
      { player: 'V. Osimhen', minute: 84, team: 'NGA', type: 'goal' }
    ]
  },
  {
    id: 'm21', groupId: 'G',
    homeTeam: { name: 'Portugal', code: 'POR', flag: '🇵🇹' },
    awayTeam: { name: 'Nigeria', code: 'NGA', flag: '🇳🇬' },
    venueId: 'v03', date: '2026-06-17', time: '14:00',
    status: 'live', score: { home: 0, away: 0 }, minute: 28,
    events: []
  },
  // ── Group H ─────────────────────────────────────────────
  {
    id: 'm22', groupId: 'H',
    homeTeam: { name: 'Belgium', code: 'BEL', flag: '🇧🇪' },
    awayTeam: { name: 'Ecuador', code: 'ECU', flag: '🇪🇨' },
    venueId: 'v02', date: '2026-06-12', time: '20:00',
    status: 'completed', score: { home: 1, away: 0 }, minute: 90,
    events: [
      { player: 'K. De Bruyne', minute: 45, team: 'BEL', type: 'goal' }
    ]
  },
  {
    id: 'm23', groupId: 'H',
    homeTeam: { name: 'Colombia', code: 'COL', flag: '🇨🇴' },
    awayTeam: { name: 'Egypt', code: 'EGY', flag: '🇪🇬' },
    venueId: 'v14', date: '2026-06-12', time: '14:00',
    status: 'completed', score: { home: 2, away: 1 }, minute: 90,
    events: [
      { player: 'L. Díaz', minute: 18, team: 'COL', type: 'goal' },
      { player: 'M. Salah', minute: 54, team: 'EGY', type: 'goal' },
      { player: 'R. Falcao', minute: 89, team: 'COL', type: 'goal' }
    ]
  },
  {
    id: 'm24', groupId: 'H',
    homeTeam: { name: 'Belgium', code: 'BEL', flag: '🇧🇪' },
    awayTeam: { name: 'Colombia', code: 'COL', flag: '🇨🇴' },
    venueId: 'v10', date: '2026-06-16', time: '17:00',
    status: 'upcoming', score: { home: 0, away: 0 }, minute: null,
    events: []
  }
];

/* ================================================================
   STATIC DATA — GROUP STANDINGS
   ================================================================ */

/**
 * @typedef {Object} Standing
 * @property {string} team
 * @property {string} code
 * @property {string} flag
 * @property {number} played
 * @property {number} won
 * @property {number} drawn
 * @property {number} lost
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number} goalDifference
 * @property {number} points
 */

/**
 * Pre-computed group standings reflecting completed match results.
 * @type {Record<string, Standing[]>}
 */
const GROUP_STANDINGS = {
  A: [
    { team: 'USA', code: 'USA', flag: '🇺🇸', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 },
    { team: 'Netherlands', code: 'NED', flag: '🇳🇱', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 1 },
    { team: 'Senegal', code: 'SEN', flag: '🇸🇳', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 1 },
    { team: 'Chile', code: 'CHI', flag: '🇨🇱', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 }
  ],
  B: [
    { team: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDifference: 2, points: 3 },
    { team: 'Japan', code: 'JPN', flag: '🇯🇵', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 },
    { team: 'Serbia', code: 'SRB', flag: '🇷🇸', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDifference: -2, points: 0 },
    { team: 'Costa Rica', code: 'CRC', flag: '🇨🇷', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 }
  ],
  C: [
    { team: 'Argentina', code: 'ARG', flag: '🇦🇷', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 0, goalDifference: 3, points: 3 },
    { team: 'Mexico', code: 'MEX', flag: '🇲🇽', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 1 },
    { team: 'Poland', code: 'POL', flag: '🇵🇱', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 1 },
    { team: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 3, goalDifference: -3, points: 0 }
  ],
  D: [
    { team: 'France', code: 'FRA', flag: '🇫🇷', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3 },
    { team: 'Denmark', code: 'DEN', flag: '🇩🇰', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1, points: 3 },
    { team: 'Australia', code: 'AUS', flag: '🇦🇺', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1, points: 0 },
    { team: 'Tunisia', code: 'TUN', flag: '🇹🇳', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 0 }
  ],
  E: [
    { team: 'Brazil', code: 'BRA', flag: '🇧🇷', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 1, goalDifference: 3, points: 3 },
    { team: 'Germany', code: 'GER', flag: '🇩🇪', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { team: 'Canada', code: 'CAN', flag: '🇨🇦', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { team: 'Cameroon', code: 'CMR', flag: '🇨🇲', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 4, goalDifference: -3, points: 0 }
  ],
  F: [
    { team: 'Spain', code: 'ESP', flag: '🇪🇸', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 0, goalDifference: 3, points: 3 },
    { team: 'Croatia', code: 'CRO', flag: '🇭🇷', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 1 },
    { team: 'Morocco', code: 'MAR', flag: '🇲🇦', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 1 },
    { team: 'South Korea', code: 'KOR', flag: '🇰🇷', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 3, goalDifference: -3, points: 0 }
  ],
  G: [
    { team: 'Portugal', code: 'POR', flag: '🇵🇹', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 },
    { team: 'Uruguay', code: 'URU', flag: '🇺🇾', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 1 },
    { team: 'Nigeria', code: 'NGA', flag: '🇳🇬', played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 1 },
    { team: 'Iran', code: 'IRN', flag: '🇮🇷', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 }
  ],
  H: [
    { team: 'Colombia', code: 'COL', flag: '🇨🇴', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3 },
    { team: 'Belgium', code: 'BEL', flag: '🇧🇪', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1, points: 3 },
    { team: 'Egypt', code: 'EGY', flag: '🇪🇬', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 0 },
    { team: 'Ecuador', code: 'ECU', flag: '🇪🇨', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1, points: 0 }
  ]
};

/* ================================================================
   STATIC DATA — ALERTS
   ================================================================ */

/**
 * @typedef {Object} Alert
 * @property {string}  id
 * @property {'crowd'|'security'|'medical'|'weather'|'facility'|'transport'} type
 * @property {'critical'|'warning'|'info'} severity
 * @property {string}  title
 * @property {string}  message
 * @property {string}  venue  – venueId
 * @property {string}  timestamp  – ISO string
 * @property {boolean} acknowledged
 */

/** @type {Alert[]} */
const ALERTS = [
  { id: 'a01', type: 'crowd', severity: 'critical', title: 'Gate A Overcrowding', message: 'Gate A at MetLife Stadium has exceeded 95% capacity. Redirect incoming fans to Gates C and D immediately.', venue: 'v01', timestamp: '2026-06-15T17:22:00Z', acknowledged: false },
  { id: 'a02', type: 'security', severity: 'warning', title: 'Prohibited Item Detected', message: 'Security checkpoint 4 flagged a prohibited item at AT&T Stadium. Security team dispatched.', venue: 'v02', timestamp: '2026-06-15T16:45:00Z', acknowledged: false },
  { id: 'a03', type: 'medical', severity: 'critical', title: 'Medical Emergency – Section 214', message: 'Heat-related medical emergency reported in Section 214 at Hard Rock Stadium. Medical team responding.', venue: 'v03', timestamp: '2026-06-15T15:30:00Z', acknowledged: true },
  { id: 'a04', type: 'weather', severity: 'warning', title: 'Thunderstorm Advisory', message: 'Severe thunderstorm warning issued for the Houston metro area. Potential match delay at NRG Stadium. Monitor conditions.', venue: 'v06', timestamp: '2026-06-15T14:00:00Z', acknowledged: false },
  { id: 'a05', type: 'facility', severity: 'info', title: 'Restroom Block C Maintenance', message: 'Restroom Block C on Concourse Level 2 at SoFi Stadium is temporarily closed for emergency plumbing repair. Estimated reopening: 30 minutes.', venue: 'v04', timestamp: '2026-06-15T16:10:00Z', acknowledged: true },
  { id: 'a06', type: 'transport', severity: 'info', title: 'Shuttle Delay – Route 3', message: 'Shuttle Route 3 (Downtown → MetLife Stadium) experiencing 15-minute delays due to traffic congestion.', venue: 'v01', timestamp: '2026-06-15T15:55:00Z', acknowledged: false },
  { id: 'a07', type: 'crowd', severity: 'warning', title: 'VIP Section Nearing Capacity', message: 'VIP Section at BMO Field is at 88% capacity. Consider limiting further VIP pass access until post-halftime.', venue: 'v15', timestamp: '2026-06-15T17:05:00Z', acknowledged: false },
  { id: 'a08', type: 'security', severity: 'info', title: 'Credential Verification Alert', message: 'Three unverified media credentials flagged at Estadio Azteca Gate B. Verification in progress.', venue: 'v12', timestamp: '2026-06-15T13:40:00Z', acknowledged: true },
  { id: 'a09', type: 'medical', severity: 'warning', title: 'First Aid Supply Low', message: 'Medical Station 2 at Lumen Field reports low supplies of ice packs and bandages. Resupply requested.', venue: 'v08', timestamp: '2026-06-15T16:30:00Z', acknowledged: false },
  { id: 'a10', type: 'facility', severity: 'warning', title: 'Wi-Fi Network Degradation', message: 'Public Wi-Fi network at Mercedes-Benz Stadium experiencing packet loss on Sectors 3-5. IT team investigating.', venue: 'v07', timestamp: '2026-06-15T17:12:00Z', acknowledged: false },
  { id: 'a11', type: 'weather', severity: 'info', title: 'UV Index Very High', message: 'UV index forecast at 9 (Very High) for Santa Clara. Sunscreen stations activated at Levi\'s Stadium.', venue: 'v11', timestamp: '2026-06-15T12:00:00Z', acknowledged: true },
  { id: 'a12', type: 'transport', severity: 'warning', title: 'Parking Lot B Full', message: 'Parking Lot B at Arrowhead Stadium has reached full capacity. Redirecting vehicles to Lot D and overflow area.', venue: 'v10', timestamp: '2026-06-15T16:50:00Z', acknowledged: false }
];

/* ================================================================
   STATIC DATA — FOOD OPTIONS
   ================================================================ */

/**
 * @typedef {Object} FoodOption
 * @property {string}  id
 * @property {string}  name
 * @property {'Fast Food'|'Beverages'|'Snacks'|'Premium'|'Healthy'} category
 * @property {number}  price         – USD
 * @property {number}  estimatedWait – minutes
 * @property {boolean} available
 * @property {boolean} popular
 * @property {string}  venue         – 'all' or specific venueId
 */

/** @type {FoodOption[]} */
const FOOD_OPTIONS = [
  { id: 'f01', name: 'Classic Hot Dog', category: 'Fast Food', price: 7.50, estimatedWait: 3, available: true, popular: true, venue: 'all' },
  { id: 'f02', name: 'Double Cheeseburger', category: 'Fast Food', price: 12.00, estimatedWait: 6, available: true, popular: true, venue: 'all' },
  { id: 'f03', name: 'Pepperoni Pizza Slice', category: 'Fast Food', price: 9.00, estimatedWait: 4, available: true, popular: true, venue: 'all' },
  { id: 'f04', name: 'Loaded Nachos', category: 'Snacks', price: 10.50, estimatedWait: 5, available: true, popular: true, venue: 'all' },
  { id: 'f05', name: 'Soft Pretzel', category: 'Snacks', price: 6.00, estimatedWait: 2, available: true, popular: false, venue: 'all' },
  { id: 'f06', name: 'Popcorn Bucket', category: 'Snacks', price: 8.00, estimatedWait: 2, available: true, popular: false, venue: 'all' },
  { id: 'f07', name: 'Draft Beer (16oz)', category: 'Beverages', price: 14.00, estimatedWait: 3, available: true, popular: true, venue: 'all' },
  { id: 'f08', name: 'Craft IPA (16oz)', category: 'Beverages', price: 16.00, estimatedWait: 4, available: true, popular: false, venue: 'all' },
  { id: 'f09', name: 'Frozen Margarita', category: 'Beverages', price: 15.00, estimatedWait: 5, available: true, popular: false, venue: 'all' },
  { id: 'f10', name: 'Bottled Water', category: 'Beverages', price: 5.00, estimatedWait: 1, available: true, popular: true, venue: 'all' },
  { id: 'f11', name: 'Fresh Fruit Cup', category: 'Healthy', price: 8.00, estimatedWait: 3, available: true, popular: false, venue: 'all' },
  { id: 'f12', name: 'Grilled Chicken Wrap', category: 'Healthy', price: 13.00, estimatedWait: 7, available: true, popular: false, venue: 'all' },
  { id: 'f13', name: 'Acai Bowl', category: 'Healthy', price: 11.00, estimatedWait: 6, available: false, popular: false, venue: 'all' },
  { id: 'f14', name: 'Wagyu Beef Slider Trio', category: 'Premium', price: 28.00, estimatedWait: 12, available: true, popular: false, venue: 'all' },
  { id: 'f15', name: 'Lobster Roll', category: 'Premium', price: 32.00, estimatedWait: 15, available: true, popular: false, venue: 'v01' },
  { id: 'f16', name: 'Tacos al Pastor', category: 'Fast Food', price: 11.00, estimatedWait: 5, available: true, popular: true, venue: 'v12' },
  { id: 'f17', name: 'Elote (Street Corn)', category: 'Snacks', price: 6.50, estimatedWait: 3, available: true, popular: true, venue: 'v12' },
  { id: 'f18', name: 'Poutine', category: 'Fast Food', price: 10.00, estimatedWait: 5, available: true, popular: true, venue: 'v15' },
  { id: 'f19', name: 'Energy Drink', category: 'Beverages', price: 7.00, estimatedWait: 1, available: true, popular: false, venue: 'all' },
  { id: 'f20', name: 'Cotton Candy', category: 'Snacks', price: 5.50, estimatedWait: 2, available: true, popular: false, venue: 'all' }
];

/* ================================================================
   ZONE TEMPLATES
   ================================================================ */

/**
 * Standard zone names used for every venue.
 * @type {string[]}
 */
const ZONE_NAMES = [
  'North Stand',
  'South Stand',
  'East Stand',
  'West Stand',
  'VIP Section',
  'General Admission',
  'Concourse Level'
];

/* ================================================================
   PLAYER POOLS (for simulated goal events)
   ================================================================ */

/**
 * Lookup of notable players per team for goal-event simulation.
 * @type {Record<string, string[]>}
 */
const PLAYER_POOLS = {
  USA: ['C. Pulisic', 'T. Weah', 'W. McKennie', 'G. Reyna', 'R. Pepi', 'B. Aaronson'],
  NED: ['C. Gakpo', 'M. Depay', 'V. van Dijk', 'X. Simons', 'D. Dumfries', 'W. Weghorst'],
  SEN: ['S. Mané', 'I. Sarr', 'B. Dia', 'K. Koulibaly', 'N. Mendy', 'P. Gueye'],
  CHI: ['A. Sánchez', 'B. Brereton Díaz', 'A. Vidal', 'E. Vargas', 'C. Aránguiz', 'D. Valdés'],
  ENG: ['H. Kane', 'J. Bellingham', 'B. Saka', 'P. Foden', 'C. Palmer', 'M. Rashford'],
  JPN: ['T. Kubo', 'K. Mitoma', 'D. Kamada', 'R. Doan', 'A. Tanaka', 'J. Ito'],
  SRB: ['D. Vlahović', 'A. Mitrović', 'D. Tadić', 'S. Milinković-Savić', 'F. Kostić', 'N. Gudelj'],
  CRC: ['K. Fuller', 'J. Campbell', 'B. Ruiz', 'A. Contreras', 'J. Venegas', 'O. Duarte'],
  ARG: ['L. Messi', 'J. Álvarez', 'L. Martínez', 'Á. Di María', 'E. Fernández', 'A. Mac Allister'],
  MEX: ['H. Lozano', 'R. Jiménez', 'S. Giménez', 'E. Álvarez', 'L. Romo', 'J. Sánchez'],
  POL: ['R. Lewandowski', 'A. Milik', 'P. Zieliński', 'S. Szymański', 'N. Zalewski', 'K. Świderski'],
  KSA: ['S. Al-Dawsari', 'S. Al-Shehri', 'F. Al-Muwallad', 'A. Al-Hassan', 'M. Kanno', 'Y. Al-Shahrani'],
  FRA: ['K. Mbappé', 'A. Griezmann', 'O. Dembélé', 'O. Giroud', 'A. Tchouaméni', 'M. Thuram'],
  DEN: ['C. Eriksen', 'R. Højlund', 'M. Damsgaard', 'J. Wind', 'A. Olsen', 'P. Højbjerg'],
  AUS: ['M. Duke', 'J. Maclaren', 'C. Goodwin', 'A. Hrustic', 'R. McGree', 'A. Mabil'],
  TUN: ['W. Khazri', 'Y. Msakni', 'H. Mejbri', 'A. Sliti', 'N. Slimane', 'E. Skhiri'],
  BRA: ['Vinícius Jr.', 'Rodrygo', 'Raphinha', 'Richarlison', 'Endrick', 'L. Paquetá'],
  GER: ['F. Wirtz', 'J. Musiala', 'K. Havertz', 'L. Sané', 'S. Gnabry', 'N. Füllkrug'],
  CAN: ['A. Davies', 'J. David', 'C. Buchanan', 'T. Buchanan', 'S. Eustáquio', 'I. Koné'],
  CMR: ['V. Aboubakar', 'E. Choupo-Moting', 'K. Toko Ekambi', 'B. Moumi Ngamaleu', 'P. Kunde', 'C. Bassogog'],
  ESP: ['L. Yamal', 'N. Williams', 'P. Gavira', 'Á. Morata', 'Pedri', 'Gavi'],
  CRO: ['L. Modrić', 'A. Kramarić', 'I. Perišić', 'M. Pašalić', 'M. Brozović', 'B. Petković'],
  MAR: ['H. Ziyech', 'Y. En-Nesyri', 'S. Amrabat', 'A. Hakimi', 'A. Ounahi', 'I. Bennacer'],
  KOR: ['Son Heung-min', 'Lee Kang-in', 'Hwang Hee-chan', 'Cho Gue-sung', 'Kim Min-jae', 'Jeong Woo-yeong'],
  POR: ['C. Ronaldo', 'B. Silva', 'B. Fernandes', 'R. Leão', 'G. Ramos', 'D. Jota'],
  URU: ['D. Núñez', 'L. Suárez', 'F. Valverde', 'R. Araújo', 'R. Bentancur', 'M. de Arrascaeta'],
  NGA: ['V. Osimhen', 'S. Chukwueze', 'A. Lookman', 'K. Iheanacho', 'J. Aribo', 'M. Simon'],
  IRN: ['S. Azmoun', 'M. Taremi', 'A. Jahanbakhsh', 'S. Moharrami', 'A. Gholizadeh', 'M. Hosseini'],
  BEL: ['K. De Bruyne', 'R. Lukaku', 'J. Doku', 'L. Openda', 'L. Trossard', 'Y. Tielemans'],
  COL: ['L. Díaz', 'R. Falcao', 'J. Cuadrado', 'D. Zapata', 'J. Arias', 'J. Lerma'],
  EGY: ['M. Salah', 'O. Marmoush', 'M. Trezeguet', 'A. Hegazi', 'T. Hamed', 'M. Elneny'],
  ECU: ['E. Valencia', 'M. Caicedo', 'G. Plata', 'P. Hincapié', 'K. Pacho', 'J. Cifuentes']
};

/* ================================================================
   RUNTIME STATE
   ================================================================ */

/** Deep-clone helper – works for JSON-safe objects. */
const clone = (obj) => JSON.parse(JSON.stringify(obj));

/** Mutable copy of matches – mutated during live simulation. */
let matchesState = clone(MATCHES);

/** Mutable copy of standings – mutated when live goals occur. */
let standingsState = clone(GROUP_STANDINGS);

/** Mutable copy of alerts – new alerts may be appended. */
let alertsState = clone(ALERTS);

/** Cached crowd-data snapshots keyed by venueId. */
const crowdCache = new Map();

/** Simulation interval handles. */
let crowdIntervalId = null;
let matchIntervalId = null;
let alertIntervalId = null;

/** Auto-incrementing alert counter. */
let alertCounter = ALERTS.length;

/* ================================================================
   CROWD DATA GENERATOR
   ================================================================ */

/**
 * Generate (or update) a crowd-data snapshot for a given venue.
 *
 * @param {string} venueId – The venue identifier
 * @returns {{
 *   venueId: string,
 *   currentAttendance: number,
 *   capacity: number,
 *   percentage: number,
 *   zones: Array<{id: string, name: string, current: number, max: number, percentage: number, trend: string}>,
 *   entryRate: number,
 *   exitRate: number,
 *   predictedPeak: number,
 *   peakTime: string,
 *   flowHistory: Array<{time: string, count: number}>
 * }}
 */
function generateCrowdData(venueId) {
  const venue = VENUES.find((v) => v.id === venueId);
  if (!venue) return null;

  const existing = crowdCache.get(venueId);

  // Base attendance: 70-95% of capacity for venues hosting live matches
  const liveAtVenue = matchesState.some(
    (m) => m.venueId === venueId && m.status === 'live'
  );
  const basePct = liveAtVenue
    ? 0.78 + Math.random() * 0.17 // 78-95%
    : 0.30 + Math.random() * 0.35; // 30-65%

  let currentAttendance;
  if (existing) {
    // Small fluctuation on existing data
    const delta = Math.floor((Math.random() - 0.45) * venue.capacity * 0.005);
    currentAttendance = Math.min(
      venue.capacity,
      Math.max(0, existing.currentAttendance + delta)
    );
  } else {
    currentAttendance = Math.floor(venue.capacity * basePct);
  }

  const percentage = Math.round((currentAttendance / venue.capacity) * 100);

  // Generate zone data
  const zoneShare = [0.18, 0.17, 0.16, 0.16, 0.08, 0.15, 0.10]; // fraction per zone
  const zones = ZONE_NAMES.map((name, i) => {
    const max = Math.floor(venue.capacity * zoneShare[i]);
    let current;
    if (existing && existing.zones[i]) {
      const d = Math.floor((Math.random() - 0.45) * max * 0.01);
      current = Math.min(max, Math.max(0, existing.zones[i].current + d));
    } else {
      current = Math.floor(max * (basePct + (Math.random() - 0.5) * 0.15));
      current = Math.min(max, Math.max(0, current));
    }
    const pct = Math.round((current / max) * 100);
    const trends = ['rising', 'stable', 'declining'];
    const trend = trends[Math.floor(Math.random() * 3)];
    return {
      id: `zone-${i + 1}`,
      name,
      current,
      max,
      percentage: pct,
      trend
    };
  });

  const entryRate = Math.floor(50 + Math.random() * 150); // people/min
  const exitRate = Math.floor(10 + Math.random() * 60);

  const predictedPeak = Math.floor(venue.capacity * (0.90 + Math.random() * 0.08));
  const now = new Date();
  const peakOffset = 30 + Math.floor(Math.random() * 60);
  const peakTime = new Date(now.getTime() + peakOffset * 60000).toISOString();

  // Build or extend flow history
  let flowHistory;
  if (existing && existing.flowHistory) {
    flowHistory = existing.flowHistory.slice(-19); // keep last 19
    flowHistory.push({
      time: now.toISOString(),
      count: currentAttendance
    });
  } else {
    flowHistory = [];
    for (let i = 12; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 5 * 60000);
      const c = Math.floor(
        venue.capacity * (basePct - 0.25 + ((12 - i) / 12) * 0.25)
      );
      flowHistory.push({
        time: t.toISOString(),
        count: Math.max(0, c)
      });
    }
  }

  const data = {
    venueId,
    currentAttendance,
    capacity: venue.capacity,
    percentage,
    zones,
    entryRate,
    exitRate,
    predictedPeak,
    peakTime,
    flowHistory
  };

  crowdCache.set(venueId, data);
  return data;
}

/* ================================================================
   VENUE STATUS GENERATOR
   ================================================================ */

/**
 * Generate facility health / operational status for a venue.
 *
 * @param {string} venueId
 * @returns {{
 *   venueId: string,
 *   overall: number,
 *   systems: Record<string, {status: string, health: number, details: string}>
 * } | null}
 */
function generateVenueStatus(venueId) {
  const venue = VENUES.find((v) => v.id === venueId);
  if (!venue) return null;

  /**
   * Helper – produce a random health score biased toward high values.
   * @param {number} min
   * @returns {number}
   */
  const health = (min = 70) =>
    Math.round(min + Math.random() * (100 - min));

  const systems = {
    power: {
      status: 'operational',
      health: health(85),
      details: 'All primary and backup generators operational.'
    },
    hvac: {
      status: 'operational',
      health: health(75),
      details: 'Climate control within target range.'
    },
    lighting: {
      status: 'operational',
      health: health(90),
      details: 'Floodlights and concourse lighting at full power.'
    },
    wifi: {
      status: health(60) > 80 ? 'operational' : 'degraded',
      health: health(60),
      details: 'Public Wi-Fi serving connected devices.'
    },
    security_cameras: {
      status: 'operational',
      health: health(80),
      details: `${venue.facilities.security * 12} cameras online.`
    },
    water: {
      status: 'operational',
      health: health(85),
      details: 'Water pressure nominal across all blocks.'
    },
    fire_safety: {
      status: 'operational',
      health: health(95),
      details: 'Sprinkler system armed. Smoke detectors online.'
    },
    pa_system: {
      status: 'operational',
      health: health(88),
      details: 'Public address system tested and operational.'
    }
  };

  // Potentially degrade wifi at Mercedes-Benz based on existing alert
  if (venueId === 'v07') {
    systems.wifi.status = 'degraded';
    systems.wifi.health = Math.min(systems.wifi.health, 62);
    systems.wifi.details =
      'Packet loss detected on Sectors 3-5. IT investigating.';
  }

  const values = Object.values(systems).map((s) => s.health);
  const overall = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return { venueId, overall, systems };
}

/* ================================================================
   DASHBOARD STATS
   ================================================================ */

/**
 * Aggregate KPIs across all venues and matches.
 *
 * @returns {{
 *   totalMatches: number,
 *   liveMatches: number,
 *   completedMatches: number,
 *   upcomingMatches: number,
 *   totalGoals: number,
 *   activeVenues: number,
 *   totalAttendance: number,
 *   activeAlerts: number,
 *   criticalAlerts: number,
 *   averageOccupancy: number
 * }}
 */
function computeDashboardStats() {
  const liveMatches = matchesState.filter((m) => m.status === 'live');
  const completedMatches = matchesState.filter((m) => m.status === 'completed');
  const upcomingMatches = matchesState.filter((m) => m.status === 'upcoming');

  const totalGoals = matchesState.reduce(
    (sum, m) => sum + m.score.home + m.score.away,
    0
  );

  // Venues with a live or today's completed match
  const activeVenueIds = new Set(
    matchesState
      .filter((m) => m.status === 'live')
      .map((m) => m.venueId)
  );

  // Sum crowd attendance at active venues
  let totalAttendance = 0;
  let occupancySum = 0;
  let venuesWithCrowd = 0;
  for (const vid of activeVenueIds) {
    const cd = generateCrowdData(vid);
    if (cd) {
      totalAttendance += cd.currentAttendance;
      occupancySum += cd.percentage;
      venuesWithCrowd++;
    }
  }
  const averageOccupancy = venuesWithCrowd
    ? Math.round(occupancySum / venuesWithCrowd)
    : 0;

  const activeAlerts = alertsState.filter((a) => !a.acknowledged).length;
  const criticalAlerts = alertsState.filter(
    (a) => a.severity === 'critical' && !a.acknowledged
  ).length;

  return {
    totalMatches: matchesState.length,
    liveMatches: liveMatches.length,
    completedMatches: completedMatches.length,
    upcomingMatches: upcomingMatches.length,
    totalGoals,
    activeVenues: activeVenueIds.size,
    totalAttendance,
    activeAlerts,
    criticalAlerts,
    averageOccupancy
  };
}

/* ================================================================
   LIVE SIMULATION ENGINE
   ================================================================ */

async function fetchLiveMatches() {
  try {
    // Determine if we are running locally or on Vercel
    const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3000' 
      : '';

    // 1. Try to fetch live matches first
    let res = await fetch(`${baseUrl}/api/matches?type=live`);
    let data = await res.json();
    let fixtures = data.response || [];
    
    // 2. If < 2 live matches, fallback to today's matches to ensure UI isn't empty
    if (fixtures.length < 2) {
      const today = new Date().toISOString().split('T')[0];
      const fallbackRes = await fetch(`${baseUrl}/api/matches?type=${today}`);
      const fallbackData = await fallbackRes.json();
      fixtures = fallbackData.response || [];
    }

    // 3. Map to our internal format
    if (fixtures.length > 0) {
      // Pick top 24 matches to avoid overwhelming UI
      fixtures = fixtures.slice(0, 24);
      
      const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      
      matchesState = fixtures.map((f, i) => {
        let status = 'upcoming';
        if (f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN') status = 'completed';
        else if (f.fixture.status.short !== 'NS' && f.fixture.status.short !== 'PST' && f.fixture.status.short !== 'CANC') status = 'live';

        return {
          id: `m_${f.fixture.id}`,
          groupId: groupLetters[i % 8], // Distribute across Groups A-H so UI filters work
          homeTeam: { name: f.teams.home.name, code: f.teams.home.name.substring(0,3).toUpperCase(), flag: f.teams.home.logo },
          awayTeam: { name: f.teams.away.name, code: f.teams.away.name.substring(0,3).toUpperCase(), flag: f.teams.away.logo },
          venueId: VENUES[i % VENUES.length].id, // Mocking venues since API venues don't match our 16 stadiums
          date: f.fixture.date.substring(0, 10),
          time: f.fixture.date.substring(11, 16),
          status: status,
          score: { home: f.goals.home || 0, away: f.goals.away || 0 },
          minute: f.fixture.status.elapsed || (status === 'completed' ? 90 : null),
          events: [] // Skipping detailed events API call for rate limits
        };
      });
      
      // Update UI
      try {
        EventBus.emit('match:update', { matches: clone(matchesState) });
        StateManager.setState('matches', clone(matchesState));
      } catch (e) {}
    }
  } catch (err) {
    console.error("API-Sports Fetch Error", err);
  }
}

/**
 * Increment goalsFor for a team in standings when a live goal is scored.
 *
 * @param {string} groupId
 * @param {string} teamCode
 */
function updateStandingsForGoal(groupId, teamCode) {
  const group = standingsState[groupId];
  if (!group) return;
  const row = group.find((r) => r.code === teamCode);
  if (row) {
    row.goalsFor++;
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }
}

/**
 * When a live match reaches 90 min and becomes completed,
 * finalize the standings (won/drawn/lost, points, goalsAgainst).
 *
 * @param {Match} match
 */
function finalizeMatchStandings(match) {
  const group = standingsState[match.groupId];
  if (!group) return;

  const home = group.find((r) => r.code === match.homeTeam.code);
  const away = group.find((r) => r.code === match.awayTeam.code);
  if (!home || !away) return;

  home.played++;
  away.played++;

  home.goalsAgainst += match.score.away;
  away.goalsAgainst += match.score.home;

  // Recalculate goalsFor from completed matches (safer)
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (match.score.home > match.score.away) {
    home.won++;
    away.lost++;
    home.points += 3;
  } else if (match.score.home < match.score.away) {
    away.won++;
    home.lost++;
    away.points += 3;
  } else {
    home.drawn++;
    away.drawn++;
    home.points += 1;
    away.points += 1;
  }

  // Sort group by points, then GD, then GF
  standingsState[match.groupId] = group.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Tick crowd data for all venues hosting live matches.
 * Emits 'crowd:update' via EventBus.
 */
function tickCrowd() {
  const liveVenueIds = [
    ...new Set(
      matchesState.filter((m) => m.status === 'live').map((m) => m.venueId)
    )
  ];

  const updates = [];
  for (const vid of liveVenueIds) {
    const data = generateCrowdData(vid);
    if (data) updates.push(data);
  }

  if (updates.length > 0) {
    try {
      EventBus.emit('crowd:update', { venues: clone(updates) });
      StateManager.setState('crowd', clone(updates));
    } catch (_) {
      // EventBus/StateManager may not be initialised yet
    }
  }
}

/** Pool of random alert templates for simulation. */
const ALERT_TEMPLATES = [
  { type: 'crowd', severity: 'warning', title: 'Concourse Congestion', message: 'Concourse Level experiencing higher-than-expected foot traffic. Consider opening auxiliary corridors.' },
  { type: 'security', severity: 'info', title: 'Routine Sweep Complete', message: 'Scheduled security sweep of all sections completed. No issues found.' },
  { type: 'medical', severity: 'info', title: 'Medical Station Report', message: 'Medical Station 1 reports 12 minor treatments administered this half. All patients released.' },
  { type: 'facility', severity: 'warning', title: 'Elevator Out of Service', message: 'Elevator 3 on the North side is temporarily out of service. Technician dispatched.' },
  { type: 'transport', severity: 'info', title: 'Metro Extra Service', message: 'Additional metro services scheduled for post-match departure. Trains running every 4 minutes.' },
  { type: 'weather', severity: 'info', title: 'Temperature Update', message: 'Current temperature 31°C (88°F). Misting stations activated in open concourse areas.' },
  { type: 'crowd', severity: 'info', title: 'Smooth Entry Flow', message: 'All entry gates reporting normal throughput. Average wait time under 3 minutes.' },
  { type: 'security', severity: 'warning', title: 'Drone Detected', message: 'Unauthorized drone detected in restricted airspace above the stadium. Counter-drone measures activated.' }
];

/**
 * Potentially inject a new alert during simulation.
 * Emits 'alert:new' via EventBus.
 */
function tickAlerts() {
  // ~40% chance per tick of generating a new alert
  if (Math.random() > 0.4) return;

  const template =
    ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
  const liveVenueIds = matchesState
    .filter((m) => m.status === 'live')
    .map((m) => m.venueId);
  const venueId =
    liveVenueIds.length > 0
      ? liveVenueIds[Math.floor(Math.random() * liveVenueIds.length)]
      : VENUES[Math.floor(Math.random() * VENUES.length)].id;

  alertCounter++;
  const newAlert = {
    id: `a${String(alertCounter).padStart(2, '0')}`,
    type: template.type,
    severity: template.severity,
    title: template.title,
    message: template.message,
    venue: venueId,
    timestamp: new Date().toISOString(),
    acknowledged: false
  };

  alertsState.push(newAlert);

  try {
    EventBus.emit('alert:new', clone(newAlert));
    StateManager.setState('alerts', clone(alertsState));
  } catch (_) {
    // EventBus/StateManager may not be initialised yet
  }
}

/* ================================================================
   PUBLIC API
   ================================================================ */

/**
 * Smart Stadium Data Service – central data provider and live simulation engine.
 *
 * @namespace DataService
 */
export const DataService = {
  /* ── Venue queries ───────────────────────────────────── */

  /**
   * Return all 16 official FIFA 2026 venues.
   * @returns {Venue[]}
   */
  getVenues() {
    return clone(VENUES);
  },

  /**
   * Return a single venue by its identifier.
   * @param {string} id
   * @returns {Venue|null}
   */
  getVenue(id) {
    const v = VENUES.find((venue) => venue.id === id);
    return v ? clone(v) : null;
  },

  /* ── Match queries ───────────────────────────────────── */

  /**
   * Return matches, optionally filtered.
   *
   * @param {Object} [filter]
   * @param {'completed'|'live'|'upcoming'} [filter.status]
   * @param {string} [filter.groupId] – e.g. 'A'
   * @param {string} [filter.venueId]
   * @param {string} [filter.date] – ISO date string
   * @returns {Match[]}
   */
  getMatches(filter = {}) {
    let result = matchesState;

    if (filter.status) {
      result = result.filter((m) => m.status === filter.status);
    }
    if (filter.groupId) {
      result = result.filter((m) => m.groupId === filter.groupId);
    }
    if (filter.venueId) {
      result = result.filter((m) => m.venueId === filter.venueId);
    }
    if (filter.date) {
      result = result.filter((m) => m.date === filter.date);
    }

    return clone(result);
  },

  /**
   * Return a single match by its identifier.
   * @param {string} id
   * @returns {Match|null}
   */
  getMatch(id) {
    const m = matchesState.find((match) => match.id === id);
    return m ? clone(m) : null;
  },

  /* ── Standings queries ───────────────────────────────── */

  /**
   * Return the standings for a specific group.
   * @param {string} groupId – e.g. 'A'
   * @returns {Standing[]|null}
   */
  getGroupStandings(groupId) {
    const g = standingsState[groupId];
    return g ? clone(g) : null;
  },

  /**
   * Return all group standings keyed by group letter.
   * @returns {Record<string, Standing[]>}
   */
  getAllGroupStandings() {
    return clone(standingsState);
  },

  /* ── Crowd analytics ─────────────────────────────────── */

  /**
   * Return crowd data for a specific venue.
   * @param {string} venueId
   * @returns {Object|null}
   */
  getCrowdData(venueId) {
    return generateCrowdData(venueId);
  },

  /* ── Alerts ──────────────────────────────────────────── */

  /**
   * Return alerts, optionally filtered.
   *
   * @param {Object} [filter]
   * @param {'critical'|'warning'|'info'} [filter.severity]
   * @param {string} [filter.type]
   * @param {string} [filter.venue] – venueId
   * @returns {Alert[]}
   */
  getAlerts(filter = {}) {
    let result = alertsState;

    if (filter.severity) {
      result = result.filter((a) => a.severity === filter.severity);
    }
    if (filter.type) {
      result = result.filter((a) => a.type === filter.type);
    }
    if (filter.venue) {
      result = result.filter((a) => a.venue === filter.venue);
    }

    return clone(result);
  },

  /* ── Food / Concessions ─────────────────────────────── */

  /**
   * Return food options available at a venue (or all).
   * @param {string} [venueId] – If omitted, returns all global items.
   * @returns {FoodOption[]}
   */
  getFoodOptions(venueId) {
    const items = FOOD_OPTIONS.filter(
      (f) => f.venue === 'all' || (venueId && f.venue === venueId)
    );
    return clone(items);
  },

  /* ── Dashboard KPIs ─────────────────────────────────── */

  /**
   * Return aggregate dashboard statistics.
   * @returns {Object}
   */
  getDashboardStats() {
    return computeDashboardStats();
  },

  /* ── Venue Status ───────────────────────────────────── */

  /**
   * Return operational / facility health for a venue.
   * @param {string} venueId
   * @returns {Object|null}
   */
  getVenueStatus(venueId) {
    return generateVenueStatus(venueId);
  },

  /* ── Simulation Control ─────────────────────────────── */

  startLiveSimulation() {
    this.stopLiveSimulation(); // Prevent duplicate intervals

    // Fetch initial matches instantly
    fetchLiveMatches();

    crowdIntervalId = setInterval(tickCrowd, 5000);
    // Poll API-Sports every 60 seconds (respecting free tier limits)
    matchIntervalId = setInterval(fetchLiveMatches, 60000);
    alertIntervalId = setInterval(tickAlerts, 30000);

    try {
      EventBus.emit('simulation:started');
    } catch (_) {
      // safe fallback
    }
  },

  /**
   * Stop all simulation intervals.
   */
  stopLiveSimulation() {
    if (crowdIntervalId !== null) {
      clearInterval(crowdIntervalId);
      crowdIntervalId = null;
    }
    if (matchIntervalId !== null) {
      clearInterval(matchIntervalId);
      matchIntervalId = null;
    }
    if (alertIntervalId !== null) {
      clearInterval(alertIntervalId);
      alertIntervalId = null;
    }

    try {
      EventBus.emit('simulation:stopped');
    } catch (_) {
      // safe fallback
    }
  }
};
