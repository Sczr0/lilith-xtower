export type ProblemFieldError = { field: string; message: string };

/**
 * RFC7807 风格的错误响应（Problem Details）。
 * - OpenAPI: application/problem+json
 */
export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string | null;
  errors?: ProblemFieldError[] | null;
  requestId?: string | null;
};

/**
 * 从 ProblemDetails（或其它未知 JSON）中提取用户可读的错误信息。
 * 优先级：detail > title > code > fallback
 */
export const extractProblemMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as ProblemDetails & { message?: unknown };

  const detail = typeof p.detail === 'string' ? p.detail.trim() : '';
  if (detail) return detail;

  const title = typeof p.title === 'string' ? p.title.trim() : '';
  if (title) return title;

  const message = typeof p.message === 'string' ? p.message.trim() : '';
  if (message) return message;

  const code = typeof p.code === 'string' ? p.code.trim() : '';
  if (code) return `${fallback}（${code}）`;

  return fallback;
};
