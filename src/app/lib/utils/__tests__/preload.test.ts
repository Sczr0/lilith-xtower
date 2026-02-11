import { describe, expect, it } from 'vitest';

import { getPreloadPolicy, resolvePreloadProfile } from '../preload';

describe('preload profile strategy', () => {
  it('returns off when user enables reduced data preference', () => {
    expect(resolvePreloadProfile({ saveData: true })).toBe('off');
    expect(resolvePreloadProfile({ prefersReducedData: true })).toBe('off');
  });

  it('returns off on weak network or low-end device', () => {
    expect(resolvePreloadProfile({ effectiveType: '2g' })).toBe('off');
    expect(resolvePreloadProfile({ downlink: 1.2 })).toBe('off');
    expect(resolvePreloadProfile({ rtt: 900 })).toBe('off');
    expect(resolvePreloadProfile({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe('off');
    expect(resolvePreloadProfile({ deviceMemory: 8, hardwareConcurrency: 2 })).toBe('off');
  });

  it('returns aggressive on strong network with capable device', () => {
    const profile = resolvePreloadProfile({
      effectiveType: '4g',
      downlink: 20,
      rtt: 60,
      deviceMemory: 16,
      hardwareConcurrency: 12,
    });

    expect(profile).toBe('aggressive');
  });

  it('returns conservative on medium network/device constraints', () => {
    expect(resolvePreloadProfile({ effectiveType: '3g', downlink: 5, rtt: 100 })).toBe('conservative');
    expect(resolvePreloadProfile({ effectiveType: '4g', downlink: 2.5, rtt: 180 })).toBe('conservative');
    expect(resolvePreloadProfile({ effectiveType: '4g', downlink: 10, rtt: 100, deviceMemory: 4, hardwareConcurrency: 8 })).toBe('conservative');
  });

  it('returns balanced by default', () => {
    const profile = resolvePreloadProfile({
      effectiveType: '4g',
      downlink: 5,
      rtt: 200,
      deviceMemory: 8,
      hardwareConcurrency: 8,
    });

    expect(profile).toBe('balanced');
  });
});

describe('preload policy mapping', () => {
  it('maps aggressive policy to faster and broader strategy', () => {
    const policy = getPreloadPolicy('aggressive');

    expect(policy.profile).toBe('aggressive');
    expect(policy.homeIdleTimeout).toBeLessThan(1_000);
    expect(policy.dashboardStage4Delay).toBeLessThan(2_000);
    expect(policy.imageDefaultConcurrent).toBe(5);
    expect(policy.sponsorsImmediateConcurrent).toBe(4);
    expect(policy.homePublicRoutes).toContain('/sponsors');
  });

  it('maps conservative policy to slower and narrower strategy', () => {
    const policy = getPreloadPolicy('conservative');

    expect(policy.profile).toBe('conservative');
    expect(policy.homeIdleTimeout).toBeGreaterThanOrEqual(3_000);
    expect(policy.dashboardRoutes).toEqual(['/about', '/qa', '/sponsors']);
    expect(policy.sponsorsDeferredConcurrent).toBe(1);
  });
});

