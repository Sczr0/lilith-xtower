'use client'

import { useState } from 'react'

export type DelegationRequest = {
  request_id: string
  client_id: string
  redirect_uri: string
  scope: string
  state?: string | null
  expires_at?: number
}

const SCOPE_LABELS: Record<string, string> = {
  'phigros.query.save.read': '读取存档、成绩与 RKS 概览',
  'phigros.query.rks.read': '读取 RKS 历史',
}

function callbackHost(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return value
  }
}

export function DelegationConsentPanel({ request }: { request: DelegationRequest }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)
  const [error, setError] = useState('')
  const scopes = request.scope.split(/\s+/).filter(Boolean)

  async function submit(decision: 'approve' | 'deny') {
    setBusy(decision)
    setError('')
    try {
      const response = await fetch('/api/delegations/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_id: request.request_id, decision }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { redirect_url?: unknown; message?: unknown }
        | null
      if (!response.ok) {
        throw new Error(
          typeof payload?.message === 'string' ? payload.message : '授权请求处理失败',
        )
      }
      if (typeof payload?.redirect_url !== 'string' || !payload.redirect_url) {
        throw new Error('服务端未返回回调地址')
      }
      window.location.assign(payload.redirect_url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '授权请求处理失败')
      setBusy(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
      <p className="text-xs font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">
        委托授权
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-neutral-100">
        允许 {request.client_id} 访问你的成绩数据？
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-neutral-400">
        授权后，应用会收到一个仅能读取下列范围的令牌。你可以随时在账户页撤销，不会影响
        Phigros Query 的正常登录。
      </p>

      <dl className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-neutral-950">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500 dark:text-neutral-500">应用</dt>
          <dd className="font-medium text-slate-900 dark:text-neutral-200">{request.client_id}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-slate-500 dark:text-neutral-500">回调</dt>
          <dd className="break-all font-mono text-xs text-slate-700 dark:text-neutral-300">
            {callbackHost(request.redirect_uri)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-200">可读取的内容</h2>
        <ul className="mt-2 space-y-2">
          {scopes.map((scope) => (
            <li
              key={scope}
              className="flex items-start gap-2 text-sm text-slate-700 dark:text-neutral-300"
            >
              <span className="mt-1 text-emerald-600 dark:text-emerald-400">✓</span>
              <span>
                {SCOPE_LABELS[scope] ?? scope}
                <span className="ml-2 font-mono text-[11px] text-slate-400">{scope}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void submit('approve')}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === 'approve' ? '正在授权…' : '同意并继续'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void submit('deny')}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {busy === 'deny' ? '正在拒绝…' : '拒绝'}
        </button>
      </div>
    </section>
  )
}
