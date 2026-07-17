import { describe, it, expect } from 'vitest';
import { Security } from '../js/services/security.js';

describe('Security utilities', () => {
  it('escapes HTML characters', () => {
    const input = '<script>alert("xss")</script>';
    expect(Security.escapeHTML(input)).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
  });

  it('sanitizes URLs and rejects unsafe protocols', () => {
    expect(Security.sanitizeURL('https://fifa.com')).toBe('https://fifa.com');
    expect(Security.sanitizeURL('javascript:alert(1)')).toBe('');
    expect(Security.sanitizeURL('/local/path')).toBe('/local/path');
  });

  it('limits input length and escapes user input', () => {
    const longInput = '<b>'.repeat(200);
    const sanitized = Security.sanitizeInput(longInput, 10);
    expect(sanitized).toBe('&lt;b&gt;&lt;b&gt;&lt;b&gt;&lt;');
  });
});
