export type AsyncState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

export const tryParseJson = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const p = payload as Record<string, unknown>;
  const error = typeof p.error === 'string' ? p.error : undefined;
  const message = typeof p.message === 'string' ? p.message : undefined;
  return error || message || fallback;
};

