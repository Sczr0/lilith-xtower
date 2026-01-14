'use client';

import { buttonStyles, cardStyles, inputStyles } from '../../../components/ui/styles';
import type { AsyncState } from '../../lib/unifiedApiDashboardUtils';
import type { UnifiedApiBindResponse, UnifiedApiTokenListResponse } from '../../../lib/types/unified-api';

interface UnifiedApiBindSectionProps {
  isAuthenticated: boolean;

  token: string;
  setToken: (value: string) => void;
  showToken: boolean;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;

  isGlobal: boolean;
  setIsGlobal: (value: boolean) => void;

  baseAuthReady: boolean;
  isBusy: boolean;

  bindState: AsyncState<UnifiedApiBindResponse>;
  tokenListState: AsyncState<UnifiedApiTokenListResponse>;

  handleBind: () => Promise<void>;
}

export function UnifiedApiBindSection({
  isAuthenticated,
  token,
  setToken,
  showToken,
  setShowToken,
  isGlobal,
  setIsGlobal,
  baseAuthReady,
  isBusy,
  bindState,
  tokenListState,
  handleBind,
}: UnifiedApiBindSectionProps) {
  return (
    <section className={cardStyles({ tone: 'glass' })}>
      <h2 className="text-lg font-semibold mb-2">联合API 绑定</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        需要你提供 token（登录凭证，敏感信息）。绑定成功后会生成“联合API用户ID”（internal_id），后续查询会用到。
      </p>

      <div className="mt-4">
        <label htmlFor="unified-api-token" className="block text-sm font-medium mb-2">
          token（登录凭证）
        </label>
        <div className="flex gap-2">
          <input
            id="unified-api-token"
            className={inputStyles({ className: 'flex-1' })}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type={showToken ? 'text' : 'password'}
            placeholder="token"
            autoComplete="off"
            disabled={!isAuthenticated}
            aria-describedby={isAuthenticated ? 'unified-api-token-help' : undefined}
          />
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? '隐藏' : '显示'}
          </button>
        </div>
        {isAuthenticated && (
          <p id="unified-api-token-help" className="mt-2 text-xs text-gray-500 dark:text-gray-500">
            如果你不确定 token，可按文档获取后手动填写。出于安全考虑，本站不会在前端自动回填 SessionToken。
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="unified-api-isGlobal"
          type="checkbox"
          className="h-4 w-4"
          checked={!!isGlobal}
          onChange={(e) => setIsGlobal(e.target.checked)}
        />
        <label htmlFor="unified-api-isGlobal" className="text-sm text-gray-700 dark:text-gray-300">
          国际服账号（可选）
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={buttonStyles({ variant: 'primary' })}
          onClick={() => void handleBind()}
          disabled={isBusy || !baseAuthReady || !isAuthenticated}
        >
          {bindState.loading ? '绑定中...' : '绑定到联合API'}
        </button>
      </div>

      {(bindState.error || tokenListState.error) && (
        <div className="mt-4 space-y-2">
          {bindState.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              绑定失败：{bindState.error}
            </div>
          )}
          {tokenListState.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              列表查询失败：{tokenListState.error}
            </div>
          )}
        </div>
      )}

      {bindState.data && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
            {bindState.data.message || '绑定成功'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">联合API用户ID（internal_id）</div>
              <div className="mt-1 font-mono text-sm break-all">{bindState.data.data.internal_id}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-neutral-950/30 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">API Token 状态（haveApiToken）</div>
              <div className="mt-1 font-mono text-sm">{bindState.data.data.haveApiToken}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">0=未设置；1=可用默认值；2=已自定义</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

