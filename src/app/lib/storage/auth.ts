'use client';

const TAPTAP_VERSION_KEY = 'phigros_taptap_version';

/**
 * 本地存储管理工具类（仅用于非敏感偏好设置）。
 *
 * 重要说明（P0-1）：
 * - 登录凭证不允许持久化到 localStorage/sessionStorage（JS 可读存储）。
 * - 凭证已迁移到服务端 HttpOnly 会话 Cookie，由服务端代理注入鉴权信息。
 */
export class AuthStorage {
  /**
   * 保存TapTap版本到本地存储
   */
  static saveTapTapVersion(version: 'cn' | 'global'): void {
    try {
      localStorage.setItem(TAPTAP_VERSION_KEY, version);
    } catch (error) {
      console.error('保存TapTap版本失败:', error);
    }
  }

  /**
   * 从本地存储读取TapTap版本
   */
  static getTapTapVersion(): 'cn' | 'global' {
    try {
      const version = localStorage.getItem(TAPTAP_VERSION_KEY);
      return (version as 'cn' | 'global') || 'cn';
    } catch (error) {
      console.error('读取TapTap版本失败:', error);
      return 'cn';
    }
  }

  /**
   * 清除本地存储中的TapTap版本
   */
  static clearTapTapVersion(): void {
    try {
      localStorage.removeItem(TAPTAP_VERSION_KEY);
    } catch (error) {
      console.error('清除TapTap版本失败:', error);
    }
  }
}
