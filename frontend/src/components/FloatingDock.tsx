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

export default function FloatingDock() {
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
    { path: '/chat', icon: ChatCircle, label: 'AI Chat' },
    { path: '/settings', icon: Gear, label: 'Settings' },
  ]

  return (
    <>
      {/* Show Dock Button - appears when dock is hidden */}
      {!dockVisible && (
        <button
          onClick={toggleDock}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-secondary-500 text-white p-3 rounded-full shadow-2xl hover:bg-secondary-600 transition-all hover:scale-110"
          title="Show Navigation Dock"
        >
          <Brain className="w-6 h-6" weight="bold" />
        </button>
      )}
      
      <nav 
        className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
          !dockVisible ? 'translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none' : ''
        }`}
      >
      <div className="bg-white/95 backdrop-blur-lg border border-gray-200 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2">
        {/* Hide/Show Toggle */}
        <button
          onClick={toggleDock}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          title="Hide/Show Dock"
        >
          {dockVisible ? (
            <CaretDown className="w-5 h-5" />
          ) : (
            <CaretUp className="w-5 h-5" />
          )}
        </button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Logo Button */}
        <button
          onClick={() => navigate('/')}
          className={`p-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 ${
            location.pathname === '/' 
              ? 'bg-secondary-500 text-white' 
              : 'bg-secondary-500 text-white hover:bg-secondary-600'
          }`}
          title="Dashboard"
        >
          <Brain className="w-5 h-5" weight="bold" />
        </button>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Navigation Buttons */}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`p-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                {item.label}
              </span>
            </button>
          )
        })}

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Training Status Indicator */}
        <div className="px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-gray-700">Active</span>
        </div>
      </div>
    </nav>
    </>
  )
}

