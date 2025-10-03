'use client';

import { AuthCredential } from '../types/auth';

const STORAGE_KEY = 'phigros_auth_credential';

/**
 * 本地存储管理工具类
 * 用于管理登录凭证的存储、读取和清除
 */
export class AuthStorage {
  /**
   * 保存登录凭证到本地存储
   */
  static saveCredential(credential: AuthCredential): void {
    try {
      const encryptedData = this.encrypt(JSON.stringify(credential));
      localStorage.setItem(STORAGE_KEY, encryptedData);
    } catch (error) {
      console.error('保存凭证失败:', error);
      throw new Error('无法保存登录凭证');
    }
  }

  /**
   * 从本地存储读取登录凭证
   */
  static getCredential(): AuthCredential | null {
    try {
      const encryptedData = localStorage.getItem(STORAGE_KEY);
      if (!encryptedData) {
        return null;
      }
      
      const decryptedData = this.decrypt(encryptedData);
      const credential = JSON.parse(decryptedData) as AuthCredential;
      
      // 验证凭证格式
      if (!this.isValidCredential(credential)) {
        this.clearCredential();
        return null;
      }
      
      return credential;
    } catch (error) {
      console.error('读取凭证失败:', error);
      this.clearCredential();
      return null;
    }
  }

  /**
   * 清除本地存储中的登录凭证
   */
  static clearCredential(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('清除凭证失败:', error);
    }
  }

  /**
   * 检查是否有有效的登录凭证
   */
  static hasValidCredential(): boolean {
    return this.getCredential() !== null;
  }

  /**
   * 简单的数据加密（混淆）
   * 在实际生产环境中应该使用更安全的加密方式
   */
  private static encrypt(data: string): string {
    // 简单的Base64编码，实际项目中应该使用更安全的加密方式
    return btoa(unescape(encodeURIComponent(data)));
  }

  /**
   * 数据解密
   */
  private static decrypt(encryptedData: string): string {
    try {
      return decodeURIComponent(escape(atob(encryptedData)));
    } catch (error) {
      throw new Error('凭证数据损坏');
    }
  }

  /**
   * 验证凭证格式是否有效
   */
  private static isValidCredential(credential: any): credential is AuthCredential {
    if (!credential || typeof credential !== 'object') {
      return false;
    }

    if (!credential.type || !credential.timestamp) {
      return false;
    }

    switch (credential.type) {
      case 'session':
        return typeof credential.token === 'string' && credential.token.length > 0;
      
      case 'api':
        return typeof credential.api_user_id === 'string' && credential.api_user_id.length > 0;
      
      case 'platform':
        return typeof credential.platform === 'string' && 
               typeof credential.platform_id === 'string' &&
               credential.platform.length > 0 &&
               credential.platform_id.length > 0;
      
      default:
        return false;
    }
  }
}