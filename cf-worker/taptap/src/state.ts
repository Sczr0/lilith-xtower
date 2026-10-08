import type { TapTapVersion } from './config';
import type { DeviceCode } from './tap';

/** 状态取值与后端 `QrCodeStatusValue` 一致（PascalCase）。 */
export type QrStatus = 'Pending' | 'Scanned' | 'Confirmed' | 'Error' | 'Expired';

/** 状态端点响应，字段与后端 `QrCodeStatusResponse` 对齐。 */
export type QrStatusResponse = {
  status: QrStatus;
  sessionToken?: string;
  errorCode?: string;
  message?: string;
  retryAfter?: number;
};

/** DO 内保存的授权流程状态（对应后端 `QrCodeStatus`）。 */
export type FlowState = {
  version: TapTapVersion;
  deviceId: string;
  deviceCode: string;
  createdAt: number;
  expiresAt: number;
  intervalMs: number;
  /** 下一次允许打上游的时刻；在 DO alarm 内自行推进（与客户端轮询解耦）。 */
  nextPollAt: number;
  /** pending=等待扫码；confirmed=已换到 sessionToken；error=终态失败。 */
  status: 'pending' | 'confirmed' | 'error';
  /** status=confirmed 时的 LeanCloud sessionToken（被 status() 一次性取走）。 */
  sessionToken?: string;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * 生成二维码里要编码的 URL（对应后端 post_qrcode）：
 * 优先上游 qrcode_url，否则把 user_code 拼到 verification_url 上。
 */
export function buildScanUrl(device: Pick<DeviceCode, 'qrcodeUrl' | 'userCode' | 'verificationUrl'>): string {
  if (device.qrcodeUrl) return device.qrcodeUrl;
  if (device.userCode) {
    const sep = device.verificationUrl.includes('?') ? '&' : '?';
    return `${device.verificationUrl}${sep}qrcode=1&user_code=${device.userCode}`;
  }
  return device.verificationUrl;
}

/** 秒数向上取整，最小 1（对齐后端 retry_after 语义）。 */
export function toRetryAfterSecs(deltaMs: number): number {
  return Math.max(1, Math.ceil(deltaMs / 1000));
}
