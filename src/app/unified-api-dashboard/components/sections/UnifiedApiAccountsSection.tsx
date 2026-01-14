'use client';

import { buttonStyles, cardStyles, inputStyles } from '../../../components/ui/styles';
import type { AsyncState } from '../../lib/unifiedApiDashboardUtils';
import type { UnifiedApiBindResponse, UnifiedApiTokenListResponse } from '../../../lib/types/unified-api';

interface UnifiedApiAccountsSectionProps {
  isAuthenticated: boolean;

  token: string;
  apiUserId: string;
  setApiUserId: (value: string) => void;
  apiToken: string;
  setApiToken: (value: string) => void;
  showApiToken: boolean;
  setShowApiToken: React.Dispatch<React.SetStateAction<boolean>>;

  internalId: string;
  defaultApiToken: string;
  copyText: (value: string, label?: string) => Promise<void>;

  bindState: AsyncState<UnifiedApiBindResponse>;
  tokenListState: AsyncState<UnifiedApiTokenListResponse>;

  listAuthReady: boolean;
  isBusy: boolean;
  handleRefreshList: () => Promise<void>;
}

export function UnifiedApiAccountsSection({
  isAuthenticated,
  token,
  apiUserId,
  setApiUserId,
  apiToken,
  setApiToken,
  showApiToken,
  setShowApiToken,
  internalId,
  defaultApiToken,
  copyText,
  bindState,
  tokenListState,
  listAuthReady,
  isBusy,
  handleRefreshList,
}: UnifiedApiAccountsSectionProps) {
  return (
    <section className={cardStyles({ tone: 'glass' })}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">已绑定平台账号</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            想查看你在联合API里绑定过哪些账号，需要填写：联合API用户ID（internal_id）与 API Token（api_token）。
          </p>
        </div>
        <button
          className={buttonStyles({ variant: 'secondary', size: 'sm' })}
          onClick={() => void handleRefreshList()}
          disabled={isBusy || !listAuthReady}
        >
          {tokenListState.loading ? '刷新中...' : '刷新列表'}
        </button>
      </div>

      {tokenListState.error && (
        <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          列表查询失败：{tokenListState.error}
        </div>
      )}

      {!listAuthReady && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          提示：请补全{' '}
          {[
            token.trim() ? null : 'token（登录凭证）',
            apiUserId.trim() ? null : '联合API用户ID（internal_id）',
            apiToken.trim() ? null : 'API Token（api_token）',
          ]
            .filter((value): value is string => !!value)
            .join(' / ')}
          。
          {bindState.data?.data?.haveApiToken === 1 && !apiToken.trim() ? (
            <span className="ml-1">haveApiToken=1 时可直接点击「填入默认值」。</span>
          ) : null}
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="unified-api-apiUserId" className="block text-sm font-medium mb-2">
          联合API用户ID（api_user_id / internal_id）
        </label>
        <div className="flex gap-2">
          <input
            id="unified-api-apiUserId"
            className={inputStyles({ className: 'flex-1 font-mono' })}
            value={apiUserId}
            onChange={(e) => setApiUserId(e.target.value)}
            placeholder={internalId || 'internal_id'}
            autoComplete="off"
            disabled={!isAuthenticated}
            aria-describedby="unified-api-apiUserId-help"
          />
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => void copyText(apiUserId || internalId || '', 'api_user_id')}
            disabled={!((apiUserId || internalId).trim())}
            title="复制 api_user_id"
          >
            复制
          </button>
        </div>
        <p id="unified-api-apiUserId-help" className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          提示：绑定成功后会自动回填；也支持手动填写（不会写入数据库）。
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="unified-api-apiToken" className="block text-sm font-medium mb-2">
          API Token（api_token）
        </label>
        <div className="flex gap-2">
          <input
            id="unified-api-apiToken"
            className={inputStyles({ className: 'flex-1' })}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            type={showApiToken ? 'text' : 'password'}
            placeholder="api_token"
            autoComplete="off"
            disabled={!isAuthenticated}
            aria-describedby="unified-api-apiToken-help"
          />
          {!apiToken.trim() && (
            <button
              type="button"
              className={buttonStyles({ variant: 'outline', size: 'sm' })}
              onClick={() => setApiToken(defaultApiToken)}
              disabled={!isAuthenticated}
              title={`填入默认值（${defaultApiToken}）`}
            >
              填入默认值
            </button>
          )}
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => setShowApiToken((v) => !v)}
          >
            {showApiToken ? '隐藏' : '显示'}
          </button>
        </div>
        <p id="unified-api-apiToken-help" className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          提示：若上方 haveApiToken=1，可点击「填入默认值」使用 {defaultApiToken}；否则请按联合API侧的实际值填写。
        </p>
      </div>

      {tokenListState.data?.data?.platform_data?.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-400">
                <th className="py-2 pr-3">平台</th>
                <th className="py-2 pr-3">平台ID</th>
                <th className="py-2 pr-3">认证类型</th>
                <th className="py-2 pr-3">更新时间</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {tokenListState.data.data.platform_data.map((p) => (
                <tr
                  key={`${p.platform_name}:${p.platform_id}`}
                  className="border-t border-gray-200/70 dark:border-neutral-800/70"
                >
                  <td className="py-2 pr-3">{p.platform_name}</td>
                  <td className="py-2 pr-3 font-mono break-all">{p.platform_id}</td>
                  <td className="py-2 pr-3 font-mono">{p.authentication}</td>
                  <td className="py-2 pr-3 font-mono break-all">{p.update_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {tokenListState.loading ? '加载中...' : '暂无数据（请先绑定或刷新列表）。'}
        </p>
      )}
    </section>
  );
}

