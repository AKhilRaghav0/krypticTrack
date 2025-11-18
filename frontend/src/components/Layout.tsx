import type { ReactNode } from 'react'
import FloatingDock from './FloatingDock'
import ThreeBackground from './ThreeBackground'
import Spotlight from './Spotlight'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <ThreeBackground />
      <main className="w-full pb-24 relative z-10">
        <div className="p-6">
          {children}
        </div>
      </main>
      <FloatingDock />
      <Spotlight />
    </div>
  )
}

