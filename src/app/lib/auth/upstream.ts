const DEFAULT_SEEKEND_API_BASE_URL = 'https://seekend.xtower.site/api/v1'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * 获取上游 API Base URL。
 * 说明：Next 配置中 /api/* 默认 rewrite 到该上游；这里用于服务端代理直连，避免递归调用本站 /api。
 */
export function getSeekendApiBaseUrl(): string {
  const fromEnv = (process.env.SEEKEND_API_BASE_URL || '').trim()
  return normalizeBaseUrl(fromEnv || DEFAULT_SEEKEND_API_BASE_URL)
}

