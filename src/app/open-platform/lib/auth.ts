export type OpenPlatformDeveloper = {
  id: string;
  githubUserId: string;
  githubLogin: string;
  email: string | null;
  role: string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized ? normalized : null;
}

/**
 * 解析 /auth/me 响应，确保字段结构符合预期。
 */
export function parseDeveloperMeResponse(payload: unknown): OpenPlatformDeveloper | null {
  if (!isRecord(payload)) return null;

  const id = getStringField(payload, 'id');
  const githubUserId = getStringField(payload, 'githubUserId');
  const githubLogin = getStringField(payload, 'githubLogin');
  const role = getStringField(payload, 'role');
  const status = getStringField(payload, 'status');

  if (!id || !githubUserId || !githubLogin || !role || !status) {
    return null;
  }

  const rawEmail = payload.email;
  if (rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') {
    return null;
  }

  const email = typeof rawEmail === 'string' ? (rawEmail.trim() || null) : null;

  return {
    id,
    githubUserId,
    githubLogin,
    email,
    role,
    status,
  };
}

/**
 * 尝试从错误响应中提取可展示的错误信息。
 */
export function extractProblemMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const detail = getStringField(payload, 'detail');
  if (detail) return detail;

  const message = getStringField(payload, 'message');
  if (message) return message;

  const title = getStringField(payload, 'title');
  if (title) return title;

  return null;
}
