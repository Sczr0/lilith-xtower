import { TapTapVersion } from '../lib/types/auth';

export const TAPTAP_BLOCK_PHRASE = '不在中国大陆地区提供服务';
export const TAPTAP_PROBE_ENDPOINT = '/api/internal/taptap-region';
export const TAPTAP_TRACE_ENDPOINT = 'https://www.taptap.io/cdn-cgi/trace';

export interface TapTapRegionDetection {
  isInternational: boolean;
  containsBlockPhrase: boolean;
}

export interface TapTapRegionResult extends TapTapRegionDetection {
  checkedAt: string;
  source?: string;
}

/**
 * 从 HTML 文本中判断是否为国际版用户：
 * - 页面包含“不在中国大陆地区提供服务” => 视为国内版
 * - 缺少该提示 => 视为国际版
 */
export const detectTapTapRegionFromHtml = (html: string): TapTapRegionDetection => {
  const containsBlockPhrase = html.includes(TAPTAP_BLOCK_PHRASE);
  return {
    containsBlockPhrase,
    isInternational: !containsBlockPhrase,
  };
};

export const tapTapVersionFromDetection = (detection: TapTapRegionDetection): TapTapVersion =>
  detection.isInternational ? 'Global' : 'CN';

/**
 * 解析 Cloudflare trace 文本，提取 loc 字段。
 */
const parseTraceLoc = (traceText: string): string | null => {
  const lines = traceText.split('\n');
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key === 'loc' && value) {
      return value.trim();
    }
  }
  return null;
};

/**
 * 通过 Cloudflare trace (taptap.io/cdn-cgi/trace) 直接使用用户网络判定地区。
 * 该端点开启了 CORS，能从浏览器读取。
 */
const detectViaTrace = async (): Promise<TapTapRegionResult> => {
  const res = await fetch(TAPTAP_TRACE_ENDPOINT, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`trace 请求失败 ${res.status}`);
  }
  const text = await res.text();
  const loc = parseTraceLoc(text);
  if (!loc) {
    throw new Error('trace 响应缺少 loc 字段');
  }
  const isInternational = loc !== 'CN';
  return {
    isInternational,
    containsBlockPhrase: !isInternational,
    checkedAt: new Date().toISOString(),
    source: TAPTAP_TRACE_ENDPOINT,
  };
};

/**
 * 调用内部探测接口，返回探测结果（包含时间戳与来源）。
 * 默认 5.5s 超时，失败会抛出异常交由 UI 处理。
 */
export const checkTapTapRegion = async (
  options?: { timeoutMs?: number },
): Promise<TapTapRegionResult> => {
  try {
    // 优先走客户端 trace（基于用户真实出口 IP）
    return await detectViaTrace();
  } catch (traceError) {
    // 回退到内部接口（可能受服务端出口地区影响）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 5500);
    try {
      const response = await fetch(TAPTAP_PROBE_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`探测接口返回 ${response.status}`);
      }

      const data = await response.json();
      return {
        isInternational: Boolean(data.isInternational),
        containsBlockPhrase: Boolean(data.containsBlockPhrase),
        checkedAt: data.checkedAt || new Date().toISOString(),
        source: data.source,
      };
    } catch (fallbackError) {
      const detail =
        fallbackError instanceof Error ? fallbackError.message : '未知错误';
      const traceMsg =
        traceError instanceof Error ? traceError.message : 'trace 失败';
      throw new Error(`自动检测 TapTap 版本失败：${traceMsg}; 回退接口也失败：${detail}`);
    } finally {
      clearTimeout(timeout);
    }
  }
};
