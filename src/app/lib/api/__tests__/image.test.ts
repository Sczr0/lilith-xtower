import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageAPI } from '../image';

const installLocalStorageMock = () => {
  const storage = {
    getItem: vi.fn(() => null as string | null),
    setItem: vi.fn(() => {}),
    removeItem: vi.fn(() => {}),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return storage;
};

const createFetchBlobMock = (blob: Blob, ok = true) =>
  vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    ({
      ok,
      async blob() {
        return blob;
      },
      async json() {
        return { message: 'Upstream error' };
      },
    }) as Response,
  );

beforeEach(() => {
  installLocalStorageMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImageAPI.generateBestNImage', () => {
  it('passes format via query string (svg)', async () => {
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' });
    const mockFetch = createFetchBlobMock(svgBlob);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await ImageAPI.generateBestNImage(27, 'dark', 'svg');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain('/api/image/bn?format=svg');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body).not.toHaveProperty('format');
    expect(body.theme).toBe('black');
  });

  it('passes format via query string (png)', async () => {
    const pngBlob = new Blob(['png'], { type: 'image/png' });
    const mockFetch = createFetchBlobMock(pngBlob);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await ImageAPI.generateBestNImage(27, 'white', 'png');

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain('/api/image/bn?format=png');

    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body).not.toHaveProperty('format');
    expect(body.theme).toBe('white');
  });
});

describe('ImageAPI.generateSongSVG', () => {
  it('requests svg via query string with song payload', async () => {
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' });
    const mockFetch = createFetchBlobMock(svgBlob);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const svg = await ImageAPI.generateSongSVG('Arcahv');

    expect(svg).toContain('<svg');
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain('/api/image/song?format=svg');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body).toEqual({ song: 'Arcahv' });
  });
});

describe('ImageAPI.generateUserBnSVG', () => {
  it('requests svg via query string with scores payload', async () => {
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' });
    const mockFetch = createFetchBlobMock(svgBlob);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const svg = await ImageAPI.generateUserBnSVG({
      nickname: '测试玩家',
      scores: [{ song: 'Arcahv', difficulty: 'IN', acc: 99.5, score: 995000 }],
    });

    expect(svg).toContain('<svg');
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(String(url)).toContain('/api/image/bn/user?format=svg');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    expect(body.nickname).toBe('测试玩家');
    expect(body.scores).toEqual([{ song: 'Arcahv', difficulty: 'IN', acc: 99.5, score: 995000 }]);
    expect(body.theme).toBe('black');
  });

  it('rejects empty scores list', async () => {
    await expect(ImageAPI.generateUserBnSVG({ nickname: 'x', scores: [] })).rejects.toThrow(
      '成绩列表不能为空',
    );
  });
});
