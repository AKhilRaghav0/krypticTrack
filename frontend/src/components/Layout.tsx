import type { ReactNode } from 'react'
import { useState } from 'react'
import FloatingDock from './FloatingDock'
import ThreeBackground from './ThreeBackground'
import Spotlight from './Spotlight'
import FloatingChat from './FloatingChat'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black relative macos-layout">
      <ThreeBackground />
      <main className="w-full pb-24 relative z-10">
        <div className="p-6">
          {children}
        </div>
      </main>
      <FloatingDock onChatClick={() => setIsChatOpen(!isChatOpen)} isChatOpen={isChatOpen} />
      <Spotlight />
      <FloatingChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  )
}

