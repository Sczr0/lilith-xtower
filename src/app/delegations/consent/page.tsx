import { redirect } from 'next/navigation'

import { getAuthSession } from '@/app/lib/auth/session'
import { getSeekendApiBaseUrl } from '@/app/lib/auth/upstream'

import { DelegationConsentPanel, type DelegationRequest } from './components/DelegationConsentPanel'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ request_id?: string }>
}

function StatePage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 dark:bg-neutral-950">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100">{title}</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-neutral-400">{detail}</p>
      </section>
    </main>
  )
}

export default async function DelegationConsentPage({ searchParams }: PageProps) {
  const { request_id: requestId } = await searchParams
  if (!requestId) {
    return <StatePage title="授权请求无效" detail="缺少 request_id，请回到应用重新发起授权。" />
  }

  const session = await getAuthSession()
  if (!session.credential) {
    const next = `/delegations/consent?request_id=${encodeURIComponent(requestId)}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  let response: Response
  try {
    response = await fetch(
      `${getSeekendApiBaseUrl()}/delegations/requests/${encodeURIComponent(requestId)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5_000) },
    )
  } catch {
    return <StatePage title="授权服务暂不可用" detail="读取授权请求超时，请稍后重试。" />
  }

  if (!response.ok) {
    return (
      <StatePage
        title="授权请求已失效"
        detail="该请求可能已过期或已被处理，请回到应用重新发起授权。"
      />
    )
  }

  const request = (await response.json().catch(() => null)) as DelegationRequest | null
  if (!request?.request_id || !request.redirect_uri) {
    return <StatePage title="授权请求无效" detail="上游返回的授权请求缺少必要字段。" />
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-neutral-950">
      <DelegationConsentPanel request={request} />
    </main>
  )
}
