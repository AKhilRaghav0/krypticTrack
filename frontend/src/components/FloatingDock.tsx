import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Brain, 
  ChartLine, 
  Broadcast, 
  Lightbulb, 
  Robot, 
  ChartBar, 
  ListChecks, 
  ChatCircle, 
  Gear,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react'

interface FloatingDockProps {
  onChatClick?: () => void
  isChatOpen?: boolean
}

export default function FloatingDock({ onChatClick, isChatOpen }: FloatingDockProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [dockVisible, setDockVisible] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('dockVisible')
    if (saved === 'false') {
      setDockVisible(false)
    }
  }, [])

  const toggleDock = () => {
    const newState = !dockVisible
    setDockVisible(newState)
    localStorage.setItem('dockVisible', newState.toString())
  }

  const navItems = [
    { path: '/', icon: ChartLine, label: 'Dashboard' },
    { path: '/live', icon: Broadcast, label: 'Live Monitor' },
    { path: '/insights', icon: Lightbulb, label: 'Insights' },
    { path: '/model', icon: Robot, label: 'Model Status' },
    { path: '/analytics', icon: ChartBar, label: 'Analytics' },
    { path: '/activity', icon: ListChecks, label: 'Activity' },
    { path: '/settings', icon: Gear, label: 'Settings' },
  ]

  const handleChatClick = () => {
    if (onChatClick) {
      onChatClick()
    } else {
      navigate('/chat')
    }
  }

  return (
    <>
      {/* Show Dock Button - appears when dock is hidden */}
      {!dockVisible && (
        <button
          onClick={toggleDock}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-[#d4a574] text-white p-3 rounded-full shadow-2xl hover:bg-[#c49564] transition-all hover:scale-110 liquid-glass"
          title="Show Navigation Dock"
        >
          <Brain className="w-6 h-6" weight="bold" />
        </button>
      )}
      
      <nav 
        className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-500 ease-out ${
          !dockVisible || isChatOpen ? 'translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none' : ''
        }`}
      >
      <div className="liquid-glass rounded-3xl shadow-2xl px-4 py-3 flex items-center gap-2 macos-dock">
        {/* Hide/Show Toggle */}
        <button
          onClick={toggleDock}
          className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Hide/Show Dock"
        >
          {dockVisible ? (
            <CaretDown className="w-5 h-5" />
          ) : (
            <CaretUp className="w-5 h-5" />
          )}
        </button>

        <div className="w-px h-8 bg-white/20 mx-1" />

        {/* Logo Button */}
        <button
          onClick={() => navigate('/')}
          className={`p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 ${
            location.pathname === '/' 
              ? 'bg-[#d4a574] text-white' 
              : 'bg-[#d4a574]/80 text-white hover:bg-[#d4a574]'
          }`}
          title="Dashboard"
        >
          <Brain className="w-5 h-5" weight="bold" />
        </button>

        <div className="w-px h-8 bg-white/20 mx-1" />

        {/* Navigation Buttons */}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`p-3 rounded-xl transition-all duration-300 group relative macos-dock-item ${
                isActive
                  ? 'bg-white/20 text-white scale-110'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-110'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" weight={isActive ? 'fill' : 'regular'} />
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-all duration-200 shadow-lg">
                {item.label}
              </span>
            </button>
          )
        })}
        
        <div className="w-px h-8 bg-white/10 mx-1" />
        
        {/* Chat Button - Floating Chat */}
        <button
          onClick={handleChatClick}
          className={`p-3 rounded-xl transition-all duration-300 group relative macos-dock-item ${
            isChatOpen
              ? 'bg-[#d4a574]/20 text-[#d4a574] scale-110'
              : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-110'
          }`}
          title="AI Chat"
        >
          <ChatCircle className="w-5 h-5" weight={isChatOpen ? 'fill' : 'regular'} />
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-all duration-200 shadow-lg">
            AI Chat
          </span>
        </button>

        <div className="w-px h-8 bg-white/20 mx-1" />

        {/* Training Status Indicator */}
        <div className="px-3 py-2 bg-white/10 rounded-xl border border-white/20 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-gray-200">Active</span>
        </div>
      </div>
    </nav>
    </>
  )
}

