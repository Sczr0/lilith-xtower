import { describe, expect, it } from 'vitest';
import { extractProblemMessage, parseDeveloperMeResponse } from './auth';

describe('open-platform/auth parser', () => {
  it('parseDeveloperMeResponse: parses valid payload', () => {
    const parsed = parseDeveloperMeResponse({
      id: 'dev_1',
      githubUserId: '1001',
      githubLogin: 'xtower',
      role: 'developer',
      status: 'active',
      email: 'dev@example.com',
    });

    expect(parsed).toEqual({
      id: 'dev_1',
      githubUserId: '1001',
      githubLogin: 'xtower',
      role: 'developer',
      status: 'active',
      email: 'dev@example.com',
    });
  });

  it('parseDeveloperMeResponse: rejects payload with missing required fields', () => {
    const parsed = parseDeveloperMeResponse({
      id: 'dev_1',
      githubLogin: 'xtower',
    });

    expect(parsed).toBeNull();
  });

  it('extractProblemMessage: follows detail > message > title priority', () => {
    expect(extractProblemMessage({ detail: 'detail message', message: 'fallback', title: 'title' })).toBe('detail message');
    expect(extractProblemMessage({ message: 'message', title: 'title' })).toBe('message');
    expect(extractProblemMessage({ title: 'title' })).toBe('title');
    expect(extractProblemMessage({ code: 'X' })).toBeNull();
  });
});
