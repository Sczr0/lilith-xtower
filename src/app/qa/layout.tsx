import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/qa',
  },
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return children
}

