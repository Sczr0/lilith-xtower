export const GLOBAL_BAN_STATUS = 403;
export const GLOBAL_BAN_CODE = 'FORBIDDEN';

type GlobalBanPayload = {
  code?: unknown;
  detail?: unknown;
  message?: unknown;
  title?: unknown;
};

export type GlobalBanDetectionResult = {
  isGlobalBan: boolean;
  detail: string | null;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseGlobalBanPayload(payload: unknown): GlobalBanDetectionResult {
  if (!payload || typeof payload !== 'object') {
    return { isGlobalBan: false, detail: null };
  }

  const data = payload as GlobalBanPayload;
  const code = toNonEmptyString(data.code);
  if (code !== GLOBAL_BAN_CODE) {
    return { isGlobalBan: false, detail: null };
  }

  const detail =
    toNonEmptyString(data.detail) ??
    toNonEmptyString(data.message) ??
    toNonEmptyString(data.title);

  return {
    isGlobalBan: true,
    detail,
  };
}

export async function detectGlobalBanFromResponse(response: Response): Promise<GlobalBanDetectionResult> {
  if (response.status !== GLOBAL_BAN_STATUS) {
    return { isGlobalBan: false, detail: null };
  }

  try {
    const payload = await response.clone().json();
    return parseGlobalBanPayload(payload);
  } catch {
    return { isGlobalBan: false, detail: null };
  }
}

function resolveRequestUrl(input: RequestInfo | URL, origin: string): URL | null {
  try {
    if (typeof input === 'string') return new URL(input, origin);
    if (input instanceof URL) return new URL(input.toString(), origin);
    if (typeof Request !== 'undefined' && input instanceof Request) return new URL(input.url, origin);
    return null;
  } catch {
    return null;
  }
}

export function shouldInspectBanForRequest(input: RequestInfo | URL, origin: string): boolean {
  const url = resolveRequestUrl(input, origin);
  if (!url) return false;
  return url.origin === origin && url.pathname.startsWith('/api') && url.pathname !== '/api/session/logout';
}
