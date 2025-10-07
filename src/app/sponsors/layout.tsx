import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/sponsors',
  },
}

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children
}

