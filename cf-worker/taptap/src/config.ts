import tapConfigJson from '../../../shared/taptap-config.json';

export type TapTapVersion = 'cn' | 'global';

export type TapConfig = {
  deviceCodeEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  leancloudBaseUrl: string;
  leancloudAppId: string;
  leancloudAppKey: string;
  clientId: string;
};

/**
 * 端点沿用本站 `shared/taptap-config.json`（accounts.tapapis.*）——已实测从 CF 边缘 cn/global 均可达。
 * 注：后端 `Next-Phi-Backend` 的 `[taptap.global]` 用了 `open.tapapis.io`，该域名 NXDOMAIN（不存在），
 * 所以这里**不要**照抄后端的 `.io`。
 */
export const TAP_CONFIG = tapConfigJson as Record<TapTapVersion, TapConfig>;

export const DEFAULT_TAPTAAP_VERSION: TapTapVersion = 'cn';

// —— 与后端 TapTapClient 对齐的参数 ——
/** 设备码请求表单版本号。 */
export const DEVICE_CODE_FORM_VERSION = '1.2.0';
/** 设备码默认有效期（秒），上游未给时回退。 */
export const DEFAULT_EXPIRES_IN_SECS = 300;
/** 轮询默认间隔（秒），上游未给时回退（后端默认 5）。 */
export const DEFAULT_INTERVAL_SECS = 5;
/** cn 版本在海外的轮询下限（秒）：cn 上游在国内，跨境轮询贵，放大间隔以减少调用。 */
export const MIN_CN_INTERVAL_SECS = 2;
export const TAP_USER_AGENT = 'TapTapAndroidSDK/3.16.5';
export const LEANCLOUD_USER_AGENT = 'LeanCloud-CSharp-SDK/1.0.3';

/** 上游请求超时（一次性调用 15s / 轮询 10s，与源站一致）。 */
export const UPSTREAM_TIMEOUT_MS = 15_000;
export const POLL_TIMEOUT_MS = 10_000;

/** 二维码会话在边缘的存活上限（对应后端 Moka 的 30 分钟 TTL）。 */
export const QR_TTL_MS = 30 * 60 * 1000;

export const VALID_TAPTAAP_VERSIONS = ['cn', 'global'] as const;
