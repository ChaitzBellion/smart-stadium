const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

// Allow local .env file when testing locally (Vercel automatically sets env vars in cloud)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

const DEFAULT_GEMINI_MODELS = [
  'gemini-1.0',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash'
];

function createApp({ apiKey = process.env.GEMINI_API_KEY, geminiModel = process.env.GEMINI_MODEL, genAI = GoogleGenAI } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const ai = new genAI({ apiKey });

  if (!apiKey) {
    console.warn('[AI Backend] GEMINI_API_KEY is not configured. /api/chat requests will fail until the environment variable is set.');
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
      const listResponse = await ai.models.listModels();
      const models = Array.isArray(listResponse.models) ? listResponse.models : listResponse;
      res.json({ success: true, models });
    } catch (error) {
      console.error('Gemini model list error:', error);
      const message = error && error.message ? error.message : 'Failed to list Gemini models';
      res.status(500).json({ error: message });
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
