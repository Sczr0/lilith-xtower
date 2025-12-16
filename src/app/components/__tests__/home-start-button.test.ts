import { describe, expect, it } from 'vitest';
import { getHomeStartHref } from '../HomeStartButton';

describe('getHomeStartHref', () => {
  it('returns /dashboard when authenticated', () => {
    expect(getHomeStartHref(true)).toBe('/dashboard');
  });

  it('returns /login when unauthenticated', () => {
    expect(getHomeStartHref(false)).toBe('/login');
  });
});

