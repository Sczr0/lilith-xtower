'use client';

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PlatformCredential, PlatformLoginForm } from '../../lib/types/auth';

export function PlatformLogin() {
  const { login, isLoading, error: authError } = useAuth();
  const [formData, setFormData] = useState<PlatformLoginForm>({
    platform: 'OneBotv11',
    platform_id: '',
  });
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.platform.trim()) {
      setError('请选择平台');
      return;
    }

    if (!formData.platform_id.trim()) {
      setError('请输入平台用户 ID');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const credential: PlatformCredential = {
        type: 'platform',
        platform: formData.platform.trim(),
        platform_id: formData.platform_id.trim(),
        timestamp: Date.now(),
      };

      await login(credential);
      
      // 登录成功后会通过AuthContext自动跳转
    } catch (error) {
      console.error('联合查分平台登录失败:', error);
      setError(error instanceof Error ? error.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // 清除错误信息
    if (error) {
      setError('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          联合查分平台登录
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          使用联合查分平台的账号登录
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            平台 *
          </label>
          <select
            id="platform"
            name="platform"
            value={formData.platform}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isSubmitting || isLoading}
          >
            <option value="OneBotv11">OneBotv11</option>
            <option value="QQ">QQ</option>
            <option value="WeChat">微信</option>
            <option value="Discord">Discord</option>
            <option value="Telegram">Telegram</option>
            <option value="other">其他平台</option>
          </select>
        </div>

        <div>
          <label htmlFor="platform_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            平台用户 ID *
          </label>
          <input
            id="platform_id"
            name="platform_id"
            type="text"
            value={formData.platform_id}
            onChange={handleChange}
            placeholder="请输入您在平台上的用户 ID"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isSubmitting || isLoading}
          />
        </div>

        {(error || authError) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-700 dark:text-red-400 text-sm">
              {error || authError}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isSubmitting || isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              登录中...
            </div>
          ) : (
            '登录'
          )}
        </button>
      </form>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
          使用说明
        </h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
          <li>• 选择您使用的平台类型</li>
          <li>• 输入您在该平台上的用户 ID</li>
          <li>• 系统将通过联合查分服务验证您的身份</li>
        </ul>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
          支持的平台
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• <strong>OneBotv11:</strong> 基于 OneBotv11 协议的机器人平台</li>
          <li>• <strong>QQBot:</strong> QQ 群官方机器人服务</li>
          <li>• <strong>其他:</strong> 支持联合查分标准的其他平台</li>
        </ul>
      </div>
    </div>
  );
}