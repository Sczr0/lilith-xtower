import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/dashboard',
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}

