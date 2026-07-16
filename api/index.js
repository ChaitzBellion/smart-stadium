const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require("@google/genai");

// Allow local .env file when testing locally (Vercel automatically sets env vars in cloud)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  res.json({
    success: true,
    response: result.text,
  });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to fetch AI response' });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const { type } = req.query; // 'live' or date
    const url = type === 'live' 
      ? "https://v3.football.api-sports.io/fixtures?live=all"
      : `https://v3.football.api-sports.io/fixtures?date=${type}`;
      
    const apiRes = await fetch(url, {
      headers: { "x-apisports-key": process.env.API_SPORTS_KEY }
    });
    const data = await apiRes.json();
    res.json(data);
  } catch (error) {
    console.error('API Sports Error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Start local server if NOT running on Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  // Serve static files from the root directory locally
  app.use(express.static(__dirname + '/..'));
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
