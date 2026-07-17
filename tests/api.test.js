import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('AI backend API', () => {
  let app;

  beforeEach(async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockReset();
    const imported = await import('../api/index.js');
    const apiModule = imported.default || imported;
    const createApp = apiModule.createApp || apiModule;
    app = createApp({ apiKey: 'test-key', genAI: class { constructor() { return { models: { generateContent: mockGenerateContent } }; } } });
  });

  it('returns 400 when prompt is missing', async () => {
    const response = await supertest(app).post('/api/chat').send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Prompt is required');
  });

  it('returns AI text when the model responds successfully', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Hello from Gemini' });
    const response = await supertest(app).post('/api/chat').send({ prompt: 'Hello' });
    expect(response.status).toBe(200);
    expect(response.body.response).toBe('Hello from Gemini');
  });

  it('falls back to the next supported Gemini model when one model is unavailable', async () => {
    mockGenerateContent.mockImplementation(async ({ model }) => {
      if (model === 'gemini-3-pro-preview') {
        const error = new Error('This model is not available');
        error.status = 404;
        throw error;
      }
      return { text: `Response from ${model}` };
    });

    const response = await supertest(app).post('/api/chat').send({ prompt: 'Hello' });
    expect(response.status).toBe(200);
    expect(response.body.response).toBe('Response from gemini-3.1-pro-preview');
  });
});
