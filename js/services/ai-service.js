/** @module AIService */
import { EventBus } from './event-bus.js';
import { StateManager } from './state-manager.js';
import { DataService } from './data-service.js';
import { Security } from './security.js';

let chatHistory = [];

export const AIService = {
  /**
   * Send a message to the AI and simulate a response
   * @param {string} userMessage 
   * @returns {Promise<{intent: string, response: string, suggestions: string[]}>}
   */
  async sendMessage(userMessage) {
    const sanitizedInput = Security.escapeHTML(userMessage.trim());
    if (!sanitizedInput) return;
    
    chatHistory.push({ role: 'user', content: sanitizedInput });
    
    // Simulate network delay
    EventBus.emit('ai:typing', true);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const intent = this._classifyIntent(sanitizedInput);
    const responseData = await this._generateResponse(intent, sanitizedInput);
    
    // Simulate streaming
    let streamedResponse = '';
    for (let i = 0; i < responseData.response.length; i++) {
      streamedResponse += responseData.response[i];
      EventBus.emit('ai:stream', streamedResponse);
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
    }
    
    EventBus.emit('ai:typing', false);
    
    chatHistory.push({ role: 'ai', content: responseData.response });
    
    // Keep only last 10 messages
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
    
    const result = {
      intent,
      response: responseData.response,
      suggestions: responseData.suggestions
    };
    
    EventBus.emit('ai:response', result);
    return result;
  },
  
  getSuggestions() {
    return [
      "What matches are on today?",
      "Find nearest restroom",
      "Food recommendations",
      "How crowded is it?",
      "Weather update",
      "Help with accessibility"
    ];
  },
  
  getHistory() {
    return [...chatHistory];
  },
  
  clearHistory() {
    chatHistory = [];
  },
  
  getIntentInfo(intent) {
    const intents = {
      match_info: { icon: '⚽', label: 'Match Info' },
      wayfinding: { icon: '🗺️', label: 'Wayfinding' },
      food: { icon: '🍔', label: 'Food & Beverage' },
      crowd: { icon: '👥', label: 'Crowd Info' },
      transport: { icon: '🚌', label: 'Transport' },
      weather: { icon: '⛅', label: 'Weather' },
      emergency: { icon: '🚨', label: 'Emergency' },
      accessibility: { icon: '♿', label: 'Accessibility' },
      venue_info: { icon: '🏟️', label: 'Venue Info' },
      general: { icon: '🤖', label: 'Assistant' }
    };
    return intents[intent] || intents.general;
  },
  
  _classifyIntent(text) {
    const lowerText = text.toLowerCase();
    
    const patterns = {
      match_info: ['match', 'score', 'game', 'playing', 'who', 'when', 'schedule', 'fixture', 'result', 'standing', 'group', 'table'],
      wayfinding: ['where', 'find', 'nearest', 'closest', 'direction', 'how to get', 'gate', 'entrance', 'exit', 'section', 'seat', 'restroom', 'bathroom', 'parking'],
      food: ['food', 'eat', 'drink', 'hungry', 'restaurant', 'menu', 'order', 'concession', 'beverage', 'snack', 'beer', 'water', 'pizza', 'hot dog'],
      crowd: ['crowd', 'busy', 'packed', 'full', 'empty', 'capacity', 'wait', 'line', 'queue', 'congested', 'density'],
      transport: ['transport', 'bus', 'train', 'metro', 'subway', 'uber', 'taxi', 'parking', 'drive', 'shuttle'],
      weather: ['weather', 'rain', 'temperature', 'hot', 'cold', 'forecast', 'sun', 'umbrella'],
      emergency: ['emergency', 'help', 'medical', 'first aid', 'security', 'lost', 'stolen', 'danger', 'police', 'ambulance'],
      accessibility: ['wheelchair', 'accessible', 'disability', 'hearing', 'impaired', 'elevator', 'ramp', 'assistance', 'quiet room', 'sensory'],
      venue_info: ['stadium', 'venue', 'capacity', 'facility', 'amenities', 'wifi', 'charging']
    };
    
    let maxScore = 0;
    let topIntent = 'general';
    
    for (const [intent, keywords] of Object.entries(patterns)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) score++;
      }
      if (score > maxScore) {
        maxScore = score;
        topIntent = intent;
      }
    }
    
    // Simple context awareness
    if (topIntent === 'general' && chatHistory.length >= 2) {
      const lastAiMessage = chatHistory[chatHistory.length - 2].content.toLowerCase();
      if (lastAiMessage.includes('food') || lastAiMessage.includes('menu')) return 'food';
      if (lastAiMessage.includes('match') || lastAiMessage.includes('score')) return 'match_info';
    }
    
    return topIntent;
  },
  
  async _generateResponse(intent, userMessage) {
    let suggestions = this.getSuggestions();
    
    // Add context to the prompt so the AI acts like a stadium assistant
    const fullPrompt = `You are the FIFA World Cup 2026 Smart Stadium Assistant. Keep your answer under 3 sentences. Be helpful and use emojis. Respond to this: ${userMessage}`;
    
    try {
      // Choose the correct backend URL for the environment.
      // - When served from a file URI, assume the local Node server is running on port 3000.
      // - When served from localhost, use the current origin.
      // - When deployed, use the relative API route.
      const baseUrl = window.location.protocol === 'file:'
        ? 'http://127.0.0.1:3000'
        : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? window.location.origin
          : '';

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      let text = data.response;
      
      // Format response slightly for HTML
      text = text.replace(/\n/g, '<br>');
      
      return { response: text, suggestions };
    } catch (e) {
      console.error("AI Fetch Error:", e);
      return {
        response: "I'm having trouble connecting to the backend AI service right now. Make sure the local API server is running or deploy the app to Vercel.",
        suggestions
      };
    }
  }
};
