'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Plus, RefreshCw, RotateCw, ShieldBan, X } from 'lucide-react';
import { buttonStyles, cardStyles, inputStyles } from '../../components/ui/styles';
import { extractProblemMessage } from '../lib/auth';
import {
  parseApiKeyIssueResponse,
  parseApiKeyListResponse,
  parseDateTimeLocalToUnixSeconds,
  type OpenPlatformApiKeyItem,
  type OpenPlatformApiKeyIssue,
} from '../lib/keys';

type ScopeOption = 'public.read' | 'profile.read';

const SCOPE_OPTIONS: ScopeOption[] = ['public.read', 'profile.read'];

type ApiRequestResult = {
  ok: boolean;
  status: number;
  payload: unknown;
};

type RequestState = {
  loading: boolean;
  error: string | null;
};

const INITIAL_REQUEST_STATE: RequestState = { loading: false, error: null };

async function requestJson(url: string, init?: RequestInit): Promise<ApiRequestResult> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json, application/problem+json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function formatUnixSeconds(value: number | null): string {
  if (!value) return '-';
  try {
    return new Date(value * 1000).toLocaleDateString();
  } catch {
    return '-';
  }
}

function normalizeName(value: string): string {
  return value.trim().slice(0, 64);
}

function normalizeReason(value: string): string {
  return value.trim().slice(0, 200);
}

async function copyText(value: string): Promise<boolean> {
  if (!value.trim()) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 开放平台 API Key 控制台（Beta 版表格布局）。
 */
export function OpenPlatformApiKeysPanel() {
  const [keys, setKeys] = useState<OpenPlatformApiKeyItem[]>([]);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [listState, setListState] = useState<RequestState>(INITIAL_REQUEST_STATE);
  const [createState, setCreateState] = useState<RequestState>(INITIAL_REQUEST_STATE);
  const [operationState, setOperationState] = useState<{ keyId: string | null; action: 'rotate' | 'revoke' | null; error: string | null }>({
    keyId: null,
    action: null,
    error: null,
  });

  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'live' | 'test'>('live');
  const [expiresAtInput, setExpiresAtInput] = useState('');
  const [scopes, setScopes] = useState<ScopeOption[]>(['public.read']);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [issued, setIssued] = useState<OpenPlatformApiKeyIssue | null>(null);
  const [copiedHint, setCopiedHint] = useState('');

  const isOperating = operationState.keyId !== null && operationState.action !== null;

  const refreshKeys = useCallback(async () => {
    setListState({ loading: true, error: null });
    setOperationState((prev) => ({ ...prev, error: null }));

    const result = await requestJson('/api/developer/api-keys', { method: 'GET' });

    if (result.status === 401) {
      setIsUnauthenticated(true);
      setKeys([]);
      setListState({ loading: false, error: null });
      return;
    }

    if (!result.ok) {
      const message = extractProblemMessage(result.payload) ?? `获取 API Key 列表失败（${result.status}）`;
      setListState({ loading: false, error: message });
      return;
    }

    const parsed = parseApiKeyListResponse(result.payload);
    if (!parsed) {
      setListState({ loading: false, error: 'API Key 列表响应格式不正确。' });
      return;
    }

    setIsUnauthenticated(false);
    setKeys(parsed);
    setListState({ loading: false, error: null });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshKeys();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshKeys]);

  useEffect(() => {
    if (!copiedHint) return;
    const timeout = setTimeout(() => setCopiedHint(''), 1600);
    return () => clearTimeout(timeout);
  }, [copiedHint]);

  const onToggleScope = (scope: ScopeOption) => {
    setScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.filter((item) => item !== scope);
      }
      return [...prev, scope];
    });
  };

  const hasAnyScope = useMemo(() => scopes.length > 0, [scopes]);

  const handleCreate = async () => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
      setCreateState({ loading: false, error: '请填写 API Key 名称。' });
      return;
    }
    if (!hasAnyScope) {
      setCreateState({ loading: false, error: '请至少选择一个 scope。' });
      return;
    }

    const expiresAt = parseDateTimeLocalToUnixSeconds(expiresAtInput);
    if (expiresAtInput.trim() && expiresAt === null) {
      setCreateState({ loading: false, error: '过期时间格式不正确。' });
      return;
    }

    setCreateState({ loading: true, error: null });
    setIssued(null);

    const body: Record<string, unknown> = {
      name: normalizedName,
      environment,
      scopes,
    };

    if (expiresAt !== null) {
      body.expiresAt = expiresAt;
    }

    const result = await requestJson('/api/developer/api-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result.status === 401) {
      setIsUnauthenticated(true);
      setCreateState({ loading: false, error: '请先完成 GitHub 登录后再创建 API Key。' });
      return;
    }

    if (!result.ok) {
      const message = extractProblemMessage(result.payload) ?? `创建 API Key 失败（${result.status}）`;
      setCreateState({ loading: false, error: message });
      return;
    }

    const issuedData = parseApiKeyIssueResponse(result.payload);
    if (!issuedData) {
      setCreateState({ loading: false, error: '创建接口响应格式不正确。' });
      return;
    }

    setCreateState({ loading: false, error: null });
    setIssued(issuedData);
    setName('');
    setExpiresAtInput('');
    setShowCreateForm(false);
    await refreshKeys();
  };

  const handleRotate = async (keyId: string) => {
    setOperationState({ keyId, action: 'rotate', error: null });
    setIssued(null);

    const result = await requestJson(`/api/developer/api-keys/${encodeURIComponent(keyId)}/rotate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (result.status === 401) {
      setIsUnauthenticated(true);
      setOperationState({ keyId: null, action: null, error: '请先完成 GitHub 登录后再轮换。' });
      return;
    }

    if (!result.ok) {
      const message = extractProblemMessage(result.payload) ?? `轮换 API Key 失败（${result.status}）`;
      setOperationState({ keyId: null, action: null, error: message });
      return;
    }

    const issuedData = parseApiKeyIssueResponse(result.payload);
    if (!issuedData) {
      setOperationState({ keyId: null, action: null, error: '轮换接口响应格式不正确。' });
      return;
    }

    setOperationState({ keyId: null, action: null, error: null });
    setIssued(issuedData);
    await refreshKeys();
  };

  const handleRevoke = async (keyId: string, keyName: string) => {
    const confirmed = window.confirm(`确认撤销 API Key「${keyName}」吗？撤销后将立即失效。`);
    if (!confirmed) return;

    const reasonInput = window.prompt('可选：填写撤销原因（将用于审计日志）', '') ?? '';
    const reason = normalizeReason(reasonInput);

    setOperationState({ keyId, action: 'revoke', error: null });

    const body = reason ? { reason } : {};
    const result = await requestJson(`/api/developer/api-keys/${encodeURIComponent(keyId)}/revoke`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (result.status === 401) {
      setIsUnauthenticated(true);
      setOperationState({ keyId: null, action: null, error: '请先完成 GitHub 登录后再撤销。' });
      return;
    }

    if (!result.ok) {
      const message = extractProblemMessage(result.payload) ?? `撤销 API Key 失败（${result.status}）`;
      setOperationState({ keyId: null, action: null, error: message });
      return;
    }

    setOperationState({ keyId: null, action: null, error: null });
    await refreshKeys();
  };

  return (
    <section className={cardStyles({ padding: 'md', className: 'bg-white dark:bg-neutral-900' })}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">API keys</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            列表为你的全部 API key。创建或轮换时会返回一次性明文 token，请立即保存，不要在浏览器或客户端中泄露。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonStyles({ variant: 'outline', size: 'sm', className: 'min-h-10' })}
            onClick={() => void refreshKeys()}
            disabled={listState.loading || createState.loading || isOperating}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            刷新
          </button>
          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm', className: 'min-h-10' })}
            onClick={() => setShowCreateForm((value) => !value)}
            disabled={createState.loading || isOperating}
          >
            {showCreateForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {showCreateForm ? '收起表单' : '创建 API key'}
          </button>
        </div>
      </div>

      {isUnauthenticated && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          当前未登录开发者账号，请先在“开发者账户”页签完成 GitHub 登录。
        </div>
      )}

      {(listState.error || createState.error || operationState.error) && (
        <div className="mt-4 space-y-2">
          {listState.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {listState.error}
            </div>
          )}
          {createState.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {createState.error}
            </div>
          )}
          {operationState.error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {operationState.error}
            </div>
          )}
        </div>
      )}

      {issued && (
        <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">已生成新 token（仅本次可见，请立即保存）。</p>
          <div className="rounded-lg border border-blue-200/70 dark:border-blue-800/70 bg-white/80 dark:bg-neutral-950/50 p-3">
            <p className="font-mono text-xs sm:text-sm break-all text-gray-900 dark:text-gray-100">{issued.token}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              onClick={() =>
                void copyText(issued.token).then((ok) => {
                  setCopiedHint(ok ? '已复制 token' : '复制失败，请手动复制');
                })
              }
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              复制 token
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">{copiedHint}</span>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-4 space-y-4">
          <h3 className="text-base font-semibold">创建 API key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="open-platform-key-name" className="block text-sm font-medium mb-2">
                名称
              </label>
              <input
                id="open-platform-key-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputStyles({ className: 'w-full' })}
                placeholder="例如：dashboard-prod"
                maxLength={64}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="open-platform-key-env" className="block text-sm font-medium mb-2">
                环境
              </label>
              <select
                id="open-platform-key-env"
                className={inputStyles({ className: 'w-full' })}
                value={environment}
                onChange={(event) => setEnvironment(event.target.value === 'test' ? 'test' : 'live')}
              >
                <option value="live">live</option>
                <option value="test">test</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="open-platform-key-expire" className="block text-sm font-medium mb-2">
              过期时间（可选）
            </label>
            <input
              id="open-platform-key-expire"
              type="datetime-local"
              value={expiresAtInput}
              onChange={(event) => setExpiresAtInput(event.target.value)}
              className={inputStyles({ className: 'w-full sm:w-auto' })}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Scopes</div>
            <div className="flex flex-wrap gap-3">
              {SCOPE_OPTIONS.map((scope) => (
                <label key={scope} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => onToggleScope(scope)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono">{scope}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
            onClick={() => void handleCreate()}
            disabled={createState.loading || listState.loading || isOperating}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {createState.loading ? '创建中...' : '提交创建'}
          </button>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div className="md:hidden">
          {listState.loading && (
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
              正在加载 API Key 列表...
            </div>
          )}

          {!listState.loading && keys.length === 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
              暂无 API Key，点击上方“创建 API key”按钮开始。
            </div>
          )}

          {!listState.loading && keys.length > 0 && (
            <div className="space-y-3">
              {keys.map((item) => {
                const isRotating = operationState.keyId === item.id && operationState.action === 'rotate';
                const isRevoking = operationState.keyId === item.id && operationState.action === 'revoke';
                const canRevoke = item.status !== 'revoked';

                return (
                  <article
                    key={`mobile:${item.id}`}
                    className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</h4>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">状态：{item.status}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        调用 {item.usageCount} 次
                      </span>
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Key</p>
                      <p className="mt-1 font-mono text-xs text-gray-700 dark:text-gray-200 break-all">{item.keyMasked}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {item.scopes.map((scope) => (
                        <span key={`mobile:${item.id}:${scope}`} className="rounded bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                          {scope}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <p>创建日期：{formatUnixSeconds(item.createdAt)}</p>
                      <p>最近使用：{formatUnixSeconds(item.lastUsedAt)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={buttonStyles({ variant: 'outline', size: 'sm', className: 'min-h-10 flex-1' })}
                        onClick={() => void handleRotate(item.id)}
                        disabled={isOperating || createState.loading || listState.loading}
                      >
                        <RotateCw className="h-4 w-4" aria-hidden="true" />
                        {isRotating ? '轮换中...' : '轮换'}
                      </button>
                      <button
                        type="button"
                        className={buttonStyles({ variant: 'danger', size: 'sm', className: 'min-h-10 flex-1' })}
                        onClick={() => void handleRevoke(item.id, item.name)}
                        disabled={!canRevoke || isOperating || createState.loading || listState.loading}
                      >
                        <ShieldBan className="h-4 w-4" aria-hidden="true" />
                        {isRevoking ? '撤销中...' : '撤销'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-900">
              <tr className="text-left text-gray-600 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Scopes</th>
                <th className="px-4 py-3 font-medium">创建日期</th>
                <th className="px-4 py-3 font-medium">最近使用日期</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {listState.loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">
                    正在加载 API Key 列表...
                  </td>
                </tr>
              )}
              {!listState.loading && keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600 dark:text-gray-400">
                    暂无 API Key，点击右上角按钮创建第一个 key。
                  </td>
                </tr>
              )}
              {!listState.loading &&
                keys.map((item) => {
                  const isRotating = operationState.keyId === item.id && operationState.action === 'rotate';
                  const isRevoking = operationState.keyId === item.id && operationState.action === 'revoke';
                  const canRevoke = item.status !== 'revoked';

                  return (
                    <tr key={item.id} className="border-t border-gray-200 dark:border-neutral-800">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.status}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 align-top">
                        {item.keyMasked}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {item.scopes.map((scope) => (
                            <span key={`${item.id}:${scope}`} className="rounded bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-[11px] font-mono text-gray-700 dark:text-gray-300">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top">{formatUnixSeconds(item.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top">{formatUnixSeconds(item.lastUsedAt)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`轮换 API Key ${item.name}`}
                            className={buttonStyles({ variant: 'outline', size: 'sm', className: 'px-2.5 py-2 min-h-10' })}
                            onClick={() => void handleRotate(item.id)}
                            disabled={isOperating || createState.loading || listState.loading}
                            title="轮换"
                          >
                            <RotateCw className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`撤销 API Key ${item.name}`}
                            className={buttonStyles({ variant: 'danger', size: 'sm', className: 'px-2.5 py-2 min-h-10' })}
                            onClick={() => void handleRevoke(item.id, item.name)}
                            disabled={!canRevoke || isOperating || createState.loading || listState.loading}
                            title="撤销"
                          >
                            <ShieldBan className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {(isRotating || isRevoking) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{isRotating ? '轮换中...' : '撤销中...'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
