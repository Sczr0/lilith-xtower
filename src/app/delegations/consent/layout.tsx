import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '委托授权 | Phigros Query',
  robots: { index: false, follow: false },
}

export default function DelegationConsentLayout({ children }: { children: React.ReactNode }) {
  return children
}
