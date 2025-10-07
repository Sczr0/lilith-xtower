import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/debug-auth',
  },
}

export default function DebugAuthLayout({ children }: { children: React.ReactNode }) {
  return children
}

