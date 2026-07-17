const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

// Allow local .env file when testing locally (Vercel automatically sets env vars in cloud)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

const DEFAULT_GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash'
];

const VENUES = [
  { id: 'v01', name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500 },
  { id: 'v02', name: 'AT&T Stadium', city: 'Arlington', country: 'USA', capacity: 80000 },
  { id: 'v03', name: 'Hard Rock Stadium', city: 'Miami Gardens', country: 'USA', capacity: 65326 },
  { id: 'v04', name: 'SoFi Stadium', city: 'Inglewood', country: 'USA', capacity: 70240 },
  { id: 'v05', name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', capacity: 87523 },
  { id: 'v06', name: 'Lumen Field', city: 'Seattle', country: 'USA', capacity: 69000 },
  { id: 'v07', name: 'BMO Field', city: 'Toronto', country: 'Canada', capacity: 45500 }
];

const ALERTS = [
  { id: 'a01', severity: 'critical', title: 'Overcrowding Risk', message: 'MetLife Stadium has exceeded 92% capacity in Zone B. Redirect fans immediately.', venueId: 'v01', timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: 'a02', severity: 'warning', title: 'Gate Queue Delay', message: 'AT&T Stadium Gate 3 is experiencing 25-minute wait times.', venueId: 'v02', timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'a03', severity: 'info', title: 'Wi-Fi Check Complete', message: 'Wi-Fi coverage at SoFi Stadium is nominal.', venueId: 'v04', timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'a04', severity: 'warning', title: 'Weather Advisory', message: 'Thunderstorm expected near Hard Rock Stadium in 30 minutes.', venueId: 'v03', timestamp: new Date(Date.now() - 900000).toISOString() }
];

const FOOD_OPTIONS = [
  { id: 'f01', name: 'Classic Burger', category: 'Fast Food', price: 12.99, waitMin: 4, available: true, popular: true, venueId: 'v01' },
  { id: 'f02', name: 'Loaded Nachos', category: 'Snacks', price: 9.99, waitMin: 3, available: true, popular: true, venueId: 'v04' },
  { id: 'f03', name: 'Draft Beer', category: 'Beverages', price: 11.5, waitMin: 2, available: true, popular: true, venueId: 'v02' },
  { id: 'f04', name: 'Poutine', category: 'Snacks', price: 10, waitMin: 5, available: true, popular: true, venueId: 'v07' },
  { id: 'f05', name: 'Tacos al Pastor', category: 'Fast Food', price: 11, waitMin: 5, available: true, popular: true, venueId: 'v05' }
];

const CROWD_ZONES = ['North Stand', 'South Stand', 'East Stand', 'West Stand', 'VIP Section', 'General Admission', 'Concourse Level'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildCrowdData(venueId) {
  const venue = VENUES.find((v) => v.id === venueId) || VENUES[0];
  const basePct = 0.65 + Math.random() * 0.25;
  const currentAttendance = Math.round(venue.capacity * clamp(basePct + (Math.random() - 0.5) * 0.08, 0.35, 0.98));
  const percentage = Math.round((currentAttendance / venue.capacity) * 100);

  const zones = CROWD_ZONES.map((name, index) => {
    const share = [0.17, 0.16, 0.15, 0.15, 0.1, 0.14, 0.13][index] || 0.1;
    const max = Math.round(venue.capacity * share);
    const current = clamp(Math.round(max * (0.6 + Math.random() * 0.35)), 0, max);
    const trendOptions = ['rising', 'stable', 'declining'];

    return {
      id: `zone-${index + 1}`,
      name,
      current,
      max,
      percentage: max ? Math.round((current / max) * 100) : 0,
      trend: trendOptions[randomInt(0, trendOptions.length - 1)]
    };
  });

  const now = new Date();
  const flowHistory = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getTime() - (11 - i) * 5 * 60000);
    const value = clamp(Math.round(currentAttendance * (0.5 + (i / 12) * 0.45) + randomInt(-1200, 1200)), 0, venue.capacity);
    return { time: date.toISOString(), count: value };
  });

  return {
    venueId: venue.id,
    venueName: venue.name,
    currentAttendance,
    capacity: venue.capacity,
    percentage,
    entryRate: randomInt(70, 150),
    exitRate: randomInt(25, 70),
    predictedPeak: clamp(Math.round(venue.capacity * (0.86 + Math.random() * 0.08)), 0, venue.capacity),
    predictedPeakTime: `${randomInt(18, 21)}:${randomInt(0, 59).toString().padStart(2, '0')}`,
    zones,
    flowHistory,
  };
}

function buildVenueStatus(venueId) {
  const venue = VENUES.find((v) => v.id === venueId) || VENUES[0];
  const overall = randomInt(72, 98);
  const statuses = {
    power: { status: 'operational', health: randomInt(85, 98), details: 'All generators are online.' },
    hvac: { status: 'operational', health: randomInt(72, 95), details: 'Climate systems operating within target range.' },
    lighting: { status: 'operational', health: randomInt(88, 99), details: 'All lighting circuits nominal.' },
    wifi: { status: randomInt(0, 1) ? 'operational' : 'degraded', health: randomInt(65, 90), details: 'Public Wi-Fi is serving devices.' },
    security_cameras: { status: 'operational', health: randomInt(80, 98), details: 'CCTV feed is stable.' },
    water: { status: 'operational', health: randomInt(84, 96), details: 'Water pressure nominal.' },
    pa_system: { status: 'operational', health: randomInt(87, 97), details: 'Public address system is working.' },
  };

  return {
    venueId: venue.id,
    name: venue.name,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    overall,
    systems: statuses,
  };
}

function buildDashboardSummary() {
  const liveMatches = randomInt(2, 6);
  const upcomingMatches = randomInt(4, 10);
  const completedMatches = randomInt(10, 18);
  const activeVenues = randomInt(2, VENUES.length);
  const totalAttendance = VENUES.slice(0, activeVenues).reduce((sum, v) => sum + Math.round(v.capacity * (0.7 + Math.random() * 0.22)), 0);
  const activeAlerts = ALERTS.filter((alert) => alert.severity !== 'info').length;
  const criticalAlerts = ALERTS.filter((alert) => alert.severity === 'critical').length;
  return {
    totalMatches: liveMatches + upcomingMatches + completedMatches,
    liveMatches,
    completedMatches,
    upcomingMatches,
    totalAttendance,
    activeVenues,
    activeAlerts,
    criticalAlerts,
    averageOccupancy: Math.round(totalAttendance / (activeVenues || 1) / 1000) * 10,
    liveMatchesData: Array.from({ length: Math.min(3, liveMatches) }, (_, i) => ({
      id: `live-${i + 1}`,
      homeTeam: `Team ${String.fromCharCode(65 + i)}`,
      awayTeam: `Team ${String.fromCharCode(68 + i)}`,
      homeScore: randomInt(0, 3),
      awayScore: randomInt(0, 3),
      minute: randomInt(12, 78),
      venue: VENUES[i % VENUES.length].name,
      status: 'live'
    })),
    venueDensities: VENUES.slice(0, 6).map((venue, index) => {
      const current = Math.round(venue.capacity * (0.58 + Math.random() * 0.3));
      const percentage = Math.round((current / venue.capacity) * 100);
      const status = percentage > 90 ? 'critical' : percentage > 75 ? 'warning' : 'operational';
      return {
        name: venue.name,
        city: venue.city,
        capacity: venue.capacity,
        current,
        percentage,
        status,
      };
    }),
    venueStatuses: VENUES.slice(0, 6).map((venue) => ({
      id: venue.id,
      name: venue.name,
      city: venue.city,
      status: ['operational', 'warning'][randomInt(0, 1)],
      percentage: randomInt(62, 94),
    })),
  };
}

function createApp({ apiKey = process.env.GEMINI_API_KEY, geminiModel = process.env.GEMINI_MODEL, genAI = GoogleGenAI } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const ai = new genAI({ apiKey });

  if (!apiKey) {
    console.warn('[AI Backend] GEMINI_API_KEY is not configured. /api/chat requests will fail until the environment variable is set.');
  }

  function normalizeModelsResponse(response) {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response.models)) {
      return response.models;
    }
    if (Array.isArray(response.pageInternal)) {
      return response.pageInternal;
    }
    return [response];
  }

  async function generateContentWithFallback(prompt) {
    const requestedModel = geminiModel;
    const models = requestedModel
      ? [requestedModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== requestedModel)]
      : DEFAULT_GEMINI_MODELS;
    let lastError = null;

    for (const modelName of models) {
      try {
        console.info(`[AI Backend] Trying Gemini model: ${modelName}`);
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        return result.text;
      } catch (error) {
        lastError = error;
        const code = error && (error.status || (error.error && error.error.code));
        const message = error && error.message ? error.message : '';
        const modelUnavailable = code === 404 || /not available/i.test(message) || /is not found/i.test(message);
        const quotaExceeded = code === 429 || /quota exceeded/i.test(message) || /rate limit/i.test(message);
        const shouldFallback = modelUnavailable || quotaExceeded;

        if (!shouldFallback) {
          throw error;
        }

        console.warn(`[AI Backend] Model ${modelName} unavailable or quota exceeded, trying next fallback model. Error: ${message}`);
      }
    }

    throw lastError || new Error('No compatible Gemini model available.');
  }

  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment' });
      }

      const responseText = await generateContentWithFallback(prompt);
      res.json({
        success: true,
        response: responseText,
      });
    } catch (error) {
      console.error('Gemini API Error:', error);
      const message = error && error.message ? error.message : 'Failed to fetch AI response';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/models', async (req, res) => {
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment' });
    }

    try {
      const listResponse = await ai.models.list();
      const models = normalizeModelsResponse(listResponse);
      const modelNames = models.map((model) => model && model.name ? model.name : model);
      res.json({ success: true, models, modelNames });
    } catch (error) {
      console.error('Gemini model list error:', error);
      const message = error && error.message ? error.message : 'Failed to list Gemini models';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/dashboard', async (req, res) => {
    try {
      res.json({ success: true, dashboard: buildDashboardSummary() });
    } catch (error) {
      console.error('Dashboard summary error:', error);
      res.status(500).json({ error: 'Failed to build dashboard summary' });
    }
  });

  app.get('/api/crowd', async (req, res) => {
    try {
      const venueId = req.query.venueId || req.query.venue || VENUES[0].id;
      const data = buildCrowdData(venueId);
      res.json({ success: true, crowd: data });
    } catch (error) {
      console.error('Crowd data error:', error);
      res.status(500).json({ error: 'Failed to fetch crowd data' });
    }
  });

  app.get('/api/alerts', async (req, res) => {
    try {
      const venueId = req.query.venueId;
      let alerts = ALERTS;
      if (venueId) {
        alerts = alerts.filter((alert) => alert.venueId === venueId);
      }
      res.json({ success: true, alerts });
    } catch (error) {
      console.error('Alerts error:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  app.get('/api/food', async (req, res) => {
    try {
      const venueId = req.query.venueId;
      const items = FOOD_OPTIONS.filter((item) => !venueId || item.venueId === venueId);
      res.json({ success: true, food: items });
    } catch (error) {
      console.error('Food data error:', error);
      res.status(500).json({ error: 'Failed to fetch food options' });
    }
  });

  app.get('/api/venues', async (req, res) => {
    try {
      res.json({ success: true, venues: VENUES.map((venue) => ({
        ...venue,
        status: ['operational', 'warning'][randomInt(0, 1)],
        percentage: randomInt(55, 95),
      })) });
    } catch (error) {
      console.error('Venues error:', error);
      res.status(500).json({ error: 'Failed to fetch venues' });
    }
  });

  app.get('/api/matches', async (req, res) => {
    try {
      const { type } = req.query; // 'live' or date
      const url = type === 'live'
        ? 'https://v3.football.api-sports.io/fixtures?live=all'
        : `https://v3.football.api-sports.io/fixtures?date=${type}`;
      
      const apiRes = await fetch(url, {
        headers: { 'x-apisports-key': process.env.API_SPORTS_KEY }
      });
      const data = await apiRes.json();
      res.json(data);
    } catch (error) {
      console.error('API Sports Error:', error);
      res.status(500).json({ error: 'Failed to fetch matches' });
    }
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

// Start local server if NOT running on Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  // Serve static files from the root directory locally
  app.use(express.static(__dirname + '/..'));
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
