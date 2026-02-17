import { describe, expect, it } from 'vitest';
import {
  parseApiKeyIssueResponse,
  parseApiKeyListResponse,
  parseDateTimeLocalToUnixSeconds,
  toDateTimeLocalValue,
} from './keys';

describe('open-platform/keys parser', () => {
  it('parseApiKeyListResponse: parses valid list payload', () => {
    const result = parseApiKeyListResponse({
      items: [
        {
          id: 'key_1',
          name: 'default',
          keyPrefix: 'pgr_live_',
          keyLast4: 'abcd',
          keyMasked: 'pgr_live_***abcd',
          scopes: ['public.read'],
          status: 'active',
          createdAt: 1730000000,
          usageCount: 10,
          lastUsedAt: 1730000600,
          lastUsedIp: '127.0.0.1',
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result?.[0].id).toBe('key_1');
    expect(result?.[0].scopes).toEqual(['public.read']);
  });

  it('parseApiKeyListResponse: returns null for invalid payload', () => {
    const result = parseApiKeyListResponse({
      items: [
        {
          id: 'key_1',
          name: 'default',
          keyPrefix: 'pgr_live_',
          keyLast4: 'abcd',
          keyMasked: 'pgr_live_***abcd',
          status: 'active',
          createdAt: 1730000000,
          usageCount: 10,
        },
      ],
    });

    expect(result).toBeNull();
  });

  it('parseApiKeyIssueResponse: parses valid issue payload', () => {
    const result = parseApiKeyIssueResponse({
      id: 'key_1',
      name: 'default',
      token: 'pgr_live_xxx',
      keyPrefix: 'pgr_live_',
      keyLast4: 'abcd',
      keyMasked: 'pgr_live_***abcd',
      scopes: ['public.read'],
      status: 'active',
      createdAt: 1730000000,
    });

    expect(result?.token).toBe('pgr_live_xxx');
  });

  it('datetime conversion helpers work as expected', () => {
    const local = toDateTimeLocalValue(1730000000);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(parseDateTimeLocalToUnixSeconds(local)).not.toBeNull();
    expect(parseDateTimeLocalToUnixSeconds('invalid')).toBeNull();
  });
});
