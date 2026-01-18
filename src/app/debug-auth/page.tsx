import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { AuthInspectorPage } from '../components/AuthInspectorPage'
import { SiteHeader } from '../components/SiteHeader'
import { buttonStyles, cardStyles, inputStyles } from '../components/ui/styles'

type SearchParams = Record<string, string | string[] | undefined>

const DEBUG_AUTH_COOKIE = 'phigros_debug_auth'

function readAuthResult(searchParams: SearchParams): string {
  const value = searchParams.auth
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? ''
  return ''
}

function DebugAuthGate(props: { failed: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950 text-gray-900 dark:text-gray-50">
      <SiteHeader showLogin={false} showLogout={false} />
      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-lg space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">认证调试入口</h1>
          <div className={cardStyles({ tone: 'glass', padding: 'md' })}>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              说明：为避免访问码出现在 URL（浏览器历史/日志/分享链接），本页改为 <strong>POST 授权</strong> 并写入
              <strong>短时</strong> HttpOnly Cookie（有效期约 10 分钟）。
            </p>

            {props.failed && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                授权失败：访问码错误或调试入口未启用。
              </div>
            )}

            <form method="post" action="/api/debug-auth/authorize" className="mt-4 space-y-3">
              <label htmlFor="debug-auth-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                访问码
              </label>
              <input
                id="debug-auth-key"
                name="key"
                type="password"
                required
                autoComplete="one-time-code"
                className={inputStyles()}
                placeholder="输入 DEBUG_AUTH_ACCESS_KEY"
              />
              <button type="submit" className={buttonStyles({ variant: 'primary', fullWidth: true })}>
                授权进入
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                返回首页
              </Link>
              <Link href="/login" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
                前往登录页
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default async function DebugAuthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // 生产环境开启 debug-auth 时，必须额外提供访问门槛，避免误开启后被外部直接访问。
  // - DEBUG_AUTH_ENABLED=1：允许路由存在（layout 级别控制）
  // - DEBUG_AUTH_ACCESS_KEY：授权密钥（authorize API 校验）
  // - phigros_debug_auth Cookie：短时放行凭证（避免 key 出现在 URL）
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_AUTH_ENABLED === '1') {
    const requiredKey = process.env.DEBUG_AUTH_ACCESS_KEY?.trim()
    if (!requiredKey) notFound()

    const cookieStore = await cookies()
    const authed = cookieStore.get(DEBUG_AUTH_COOKIE)?.value === '1'
    if (!authed) {
      const resolvedSearchParams = await searchParams
      return <DebugAuthGate failed={readAuthResult(resolvedSearchParams) === 'failed'} />
    }
  }

  return <AuthInspectorPage mode="debug" />
}
