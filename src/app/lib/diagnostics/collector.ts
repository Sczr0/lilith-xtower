/**
 * 前端诊断信息采集器（isomorphic：无顶层浏览器访问，可在服务端组件导入）
 *
 * 职责：
 * - 维护环形缓冲的事件轨迹（fetch / 路由 / 错误），用于生成“诊断信息”块
 * - 捕获全局错误并去重上报 /api/report（自动路径，无需用户操作）
 * - 提供 getDiagnosticsSnapshot()/formatDiagnosticsBlock() 供反馈弹窗、错误页复制或随反馈提交
 *
 * 隐私边界：不采集请求 body/query/headers、用户输入内容、DOM 与截图；
 * 会话标识一律脱敏，token 永不进入本模块。
 */

export const APP_BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

const MAX_EVENTS = 20;
const ERROR_REPORTED_KEY = 'phigros_error_reported';
const MAX_REPORTED_SIGNATURES = 20;

export type DiagnosticEventType = 'fetch' | 'route' | 'error';

export interface DiagnosticEvent {
  /** 毫秒时间戳 */
  t: number;
  type: DiagnosticEventType;
  /** fetch 的 pathname（已去 query）或路由目标 */
  url?: string;
  method?: string;
  status?: number;
  durMs?: number;
  message?: string;
  stack?: string;
}

export interface DiagnosticsLogin {
  authenticated: boolean;
  /** 登录方式（credential.type，如 session/api/platform） */
  method?: string;
}

export interface DiagnosticsSnapshot {
  version: string;
  t: number;
  page: string;
  ua: string;
  parsedUA: ParsedUA;
  online: boolean;
  networkType?: string;
  login: DiagnosticsLogin;
  viewId: string;
  events: DiagnosticEvent[];
}

export interface ParsedUA {
  browser: string;
  os: string;
  mobile: boolean;
}

let events: DiagnosticEvent[] = [];
let viewId = `${Date.now()}-0`;
let viewCounter = 0;
let loginInfo: DiagnosticsLogin = { authenticated: false };

// ---------- 纯逻辑（可在 node 环境测试） ----------

export function pushEvent(event: DiagnosticEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function getEvents(): DiagnosticEvent[] {
  return [...events];
}

export function clearEvents(): void {
  events = [];
}

export function nextViewId(): string {
  viewCounter = (viewCounter + 1) % 1_000_000;
  viewId = `${Date.now()}-${viewCounter}`;
  return viewId;
}

export function setDiagnosticsLogin(info: DiagnosticsLogin): void {
  loginInfo = info;
}

export function getDiagnosticsLogin(): DiagnosticsLogin {
  return { ...loginInfo };
}

/** 错误上报去重签名：同 message+页面 每会话只报一次 */
export function computeErrorSignature(message: string, location?: string): string {
  return `${message}|${location ?? ''}`.slice(0, 200);
}

export function parseUserAgent(ua: string): ParsedUA {
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  let browser = '未知浏览器';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/MicroMessenger/i.test(ua)) browser = '微信内置浏览器';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  let os = '未知系统';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return { browser, os, mobile };
}

export function formatDiagnosticsBlock(s: DiagnosticsSnapshot): string {
  const lines: string[] = [];
  lines.push(`【诊断信息】Phigros Query v${s.version}`);
  lines.push(`时间: ${formatTimestamp(s.t)}`);
  lines.push(`页面: ${s.page || '未知'}`);
  lines.push(
    `浏览器: ${s.parsedUA.browser} / ${s.parsedUA.os}${s.parsedUA.mobile ? ' (移动端)' : ' (桌面端)'}`,
  );
  lines.push(`网络: ${s.online ? '在线' : '离线'}${s.networkType ? ` (${s.networkType})` : ''}`);
  lines.push(
    `登录: ${s.login.authenticated ? `是${s.login.method ? ` (${s.login.method})` : ''}` : '否'}`,
  );
  lines.push(`会话: ${s.viewId}`);

  const actions = s.events.filter((e) => e.type !== 'error');
  if (actions.length) {
    lines.push('最近操作:');
    for (const e of actions) lines.push(`  ${formatEventLine(e)}`);
  } else {
    lines.push('最近操作: 无');
  }

  const errors = s.events.filter((e) => e.type === 'error');
  if (errors.length) {
    lines.push('最近错误:');
    for (const e of errors) {
      lines.push(`  ${formatEventLine(e)}`);
      const firstStackLine = e.stack?.split('\n')[1]?.trim();
      if (firstStackLine) lines.push(`    ${firstStackLine}`);
    }
  }
  return lines.join('\n');
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(ts);
  }
}

function formatEventLine(e: DiagnosticEvent): string {
  const time = new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false });
  if (e.type === 'fetch') {
    return `${time} ${e.method ?? 'GET'} ${e.url ?? ''} → ${e.status ?? '失败'} (${e.durMs ?? '?'}ms)`;
  }
  if (e.type === 'route') {
    return `${time} 页面切换 → ${e.url ?? ''}`;
  }
  return `${time} 错误: ${truncate(e.message ?? '未知错误', 120)}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// ---------- 浏览器环境采集（仅客户端调用） ----------

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function stripQuery(url: string): string {
  try {
    return url.split('?')[0] ?? url;
  } catch {
    return url;
  }
}

/** 采集当前快照（在调用时读取浏览器状态，保证“复制/提交”时数据最新） */
export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  const ua = isBrowser() ? navigator.userAgent : '';
  const connection = isBrowser()
    ? (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
    : undefined;
  return {
    version: APP_BUILD_ID,
    t: Date.now(),
    page: isBrowser() ? window.location.pathname : '',
    ua,
    parsedUA: parseUserAgent(ua),
    online: !isBrowser() || navigator.onLine,
    networkType: connection?.effectiveType,
    login: getDiagnosticsLogin(),
    viewId,
    events: getEvents(),
  };
}

/** 捕获全局 error / unhandledrejection，记录轨迹并回调（回调内做上报） */
export function installErrorCapture(
  onCapture: (err: { message: string; stack?: string }) => void,
): () => void {
  if (!isBrowser()) return () => {};

  const handleWindowError = (event: ErrorEvent) => {
    const message = event.message || event.error?.message || 'Unknown error';
    const stack = typeof event.error?.stack === 'string' ? event.error.stack : undefined;
    pushEvent({ t: Date.now(), type: 'error', message, stack });
    onCapture({ message, stack });
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Unhandled promise rejection';
    const stack = reason instanceof Error ? reason.stack : undefined;
    pushEvent({ t: Date.now(), type: 'error', message, stack });
    onCapture({ message, stack });
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}

/**
 * 包装 window.fetch 记录请求轨迹（动态委托调用时的当前 fetch，
 * 与 AuthContext 的全局 fetch 补丁顺序无关，天然可组合）。
 * 仅记录 pathname/method/status/耗时，不采集 body/query/headers。
 */
export function installFetchPatch(): () => void {
  if (!isBrowser()) return () => {};
  const nativeFetch = window.fetch.bind(window);

  const wrapper: typeof window.fetch = (input, init) => {
    const startedAt = performance.now();
    const describe = (): { url?: string; method?: string } => {
      if (typeof input === 'string' || input instanceof URL) {
        return { url: stripQuery(String(input)), method: init?.method ?? 'GET' };
      }
      return { url: stripQuery(input?.url ?? ''), method: init?.method ?? input?.method ?? 'GET' };
    };

    return nativeFetch(input, init)
      .then((res) => {
        const { url, method } = describe();
        pushEvent({
          t: Date.now(),
          type: 'fetch',
          url,
          method,
          status: res.status,
          durMs: Math.round(performance.now() - startedAt),
        });
        return res;
      })
      .catch((err: unknown) => {
        const { url, method } = describe();
        pushEvent({
          t: Date.now(),
          type: 'fetch',
          url,
          method,
          status: undefined,
          durMs: Math.round(performance.now() - startedAt),
        });
        throw err;
      });
  };

  window.fetch = wrapper;
  return () => {
    window.fetch = nativeFetch;
  };
}

/** 记录 SPA 路由切换（pushState/replaceState/popstate），并刷新 viewId 用于按视图聚合 */
export function installRouteTracking(): () => void {
  if (!isBrowser()) return () => {};

  const record = () => {
    pushEvent({ t: Date.now(), type: 'route', url: window.location.pathname });
    nextViewId();
  };

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function pushStatePatched(...args) {
    const result = originalPush.apply(this, args);
    record();
    return result;
  };
  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplace.apply(this, args);
    record();
    return result;
  };
  window.addEventListener('popstate', record);

  return () => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    window.removeEventListener('popstate', record);
  };
}

// ---------- 上报 ----------

function loadReportedSignatures(): string[] {
  try {
    const raw = sessionStorage.getItem(ERROR_REPORTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveReportedSignatures(signatures: string[]): void {
  try {
    sessionStorage.setItem(
      ERROR_REPORTED_KEY,
      JSON.stringify(signatures.slice(-MAX_REPORTED_SIGNATURES)),
    );
  } catch {
    // 隐私模式等场景忽略
  }
}

/** 同签名错误每会话只上报一次（防错误循环轰炸） */
export function shouldReportError(message: string, location?: string): boolean {
  if (!isBrowser()) return false;
  const signature = computeErrorSignature(message, location);
  const signatures = loadReportedSignatures();
  if (signatures.includes(signature)) return false;
  saveReportedSignatures([...signatures, signature]);
  return true;
}

/** sendBeacon 优先，回退 fetch keepalive（同 WebVitals 模式） */
export function reportToServer(payload: Record<string, unknown>): void {
  if (!isBrowser()) return;
  const body = JSON.stringify(payload);
  const url = '/api/report';
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {
    // 回退 fetch
  }
  fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

/** 自动路径：记录并上报一个错误（带去重） */
export function reportErrorToServer(
  message: string,
  stack?: string,
  location?: string,
): void {
  if (!shouldReportError(message, location)) return;
  reportToServer({
    kind: 'error',
    message: message.slice(0, 1000),
    stack: stack ? stack.slice(0, 8000) : undefined,
    page: location ?? (isBrowser() ? window.location.pathname : undefined),
    t: Date.now(),
    viewId,
    version: APP_BUILD_ID,
    events: getEvents().slice(-20),
  });
}
