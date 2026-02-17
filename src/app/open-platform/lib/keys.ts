export type OpenPlatformApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  keyLast4: string;
  keyMasked: string;
  scopes: string[];
  status: string;
  createdAt: number;
  usageCount: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  lastUsedIp: string | null;
  revokedAt: number | null;
  replacedByKeyId: string | null;
};

export type OpenPlatformApiKeyIssue = {
  id: string;
  name: string;
  token: string;
  keyPrefix: string;
  keyLast4: string;
  keyMasked: string;
  scopes: string[];
  status: string;
  createdAt: number;
  expiresAt: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(source: Record<string, unknown>, field: string): string | null {
  const raw = source[field];
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim();
  return normalized ? normalized : null;
}

function readNullableString(source: Record<string, unknown>, field: string): string | null {
  const raw = source[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim();
  return normalized ? normalized : null;
}

function readNumber(source: Record<string, unknown>, field: string): number | null {
  const raw = source[field];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

function readNullableNumber(source: Record<string, unknown>, field: string): number | null {
  const raw = source[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

function readStringArray(source: Record<string, unknown>, field: string): string[] | null {
  const raw = source[field];
  if (!Array.isArray(raw)) return null;

  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const normalized = item.trim();
    if (normalized) {
      result.push(normalized);
    }
  }

  return result;
}

function parseApiKeyItem(value: unknown): OpenPlatformApiKeyItem | null {
  if (!isRecord(value)) return null;

  const id = readString(value, 'id');
  const name = readString(value, 'name');
  const keyPrefix = readString(value, 'keyPrefix');
  const keyLast4 = readString(value, 'keyLast4');
  const keyMasked = readString(value, 'keyMasked');
  const status = readString(value, 'status');
  const scopes = readStringArray(value, 'scopes');
  const createdAt = readNumber(value, 'createdAt');
  const usageCount = readNumber(value, 'usageCount');

  if (!id || !name || !keyPrefix || !keyLast4 || !keyMasked || !status || !scopes || createdAt === null || usageCount === null) {
    return null;
  }

  return {
    id,
    name,
    keyPrefix,
    keyLast4,
    keyMasked,
    status,
    scopes,
    createdAt,
    usageCount,
    expiresAt: readNullableNumber(value, 'expiresAt'),
    lastUsedAt: readNullableNumber(value, 'lastUsedAt'),
    lastUsedIp: readNullableString(value, 'lastUsedIp'),
    revokedAt: readNullableNumber(value, 'revokedAt'),
    replacedByKeyId: readNullableString(value, 'replacedByKeyId'),
  };
}

/**
 * 解析 API Key 列表响应，确保 items 为可用结构。
 */
export function parseApiKeyListResponse(payload: unknown): OpenPlatformApiKeyItem[] | null {
  if (!isRecord(payload)) return null;

  const rawItems = payload.items;
  if (!Array.isArray(rawItems)) return null;

  const items: OpenPlatformApiKeyItem[] = [];
  for (const rawItem of rawItems) {
    const item = parseApiKeyItem(rawItem);
    if (!item) return null;
    items.push(item);
  }

  return items;
}

/**
 * 解析创建/轮换返回的“明文仅一次”响应。
 */
export function parseApiKeyIssueResponse(payload: unknown): OpenPlatformApiKeyIssue | null {
  if (!isRecord(payload)) return null;

  const id = readString(payload, 'id');
  const name = readString(payload, 'name');
  const token = readString(payload, 'token');
  const keyPrefix = readString(payload, 'keyPrefix');
  const keyLast4 = readString(payload, 'keyLast4');
  const keyMasked = readString(payload, 'keyMasked');
  const status = readString(payload, 'status');
  const scopes = readStringArray(payload, 'scopes');
  const createdAt = readNumber(payload, 'createdAt');

  if (!id || !name || !token || !keyPrefix || !keyLast4 || !keyMasked || !status || !scopes || createdAt === null) {
    return null;
  }

  return {
    id,
    name,
    token,
    keyPrefix,
    keyLast4,
    keyMasked,
    status,
    scopes,
    createdAt,
    expiresAt: readNullableNumber(payload, 'expiresAt'),
  };
}

/**
 * 转换为本地 datetime-local 输入值（秒级时间戳 -> 本地时间字符串）。
 */
export function toDateTimeLocalValue(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * datetime-local 输入值转换为 Unix 秒；非法输入返回 null。
 */
export function parseDateTimeLocalToUnixSeconds(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;

  return Math.floor(parsed / 1000);
}
