const STORAGE_KEY = 'phigros_post_login_next'

export function isSafeNext(value: string | null): value is string {
  return Boolean(value) && value!.startsWith('/') && !value!.startsWith('//') && !value!.includes('\\')
}

export function rememberPostLoginRedirect(value: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (isSafeNext(value)) window.sessionStorage.setItem(STORAGE_KEY, value)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage 被禁用时忽略；登录仍回 dashboard。
  }
}

export function consumePostLoginRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    window.sessionStorage.removeItem(STORAGE_KEY)
    return isSafeNext(value) ? value : '/dashboard'
  } catch {
    return '/dashboard'
  }
}
