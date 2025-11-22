import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { House, ListBullets, CheckSquare, Target, Lightbulb, Gear } from '@phosphor-icons/react'
import { ThemeProvider } from './contexts/ThemeContext'
import { Dashboard } from './pages/Dashboard'
import { Sessions } from './pages/Sessions'
import { Habits } from './pages/Habits'
import { Goals } from './pages/Goals'
import { Insights } from './pages/Insights'
import { Settings } from './pages/Settings'
import './index.css'

function NavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg font-mono transition-all duration-200 ${isActive
          ? 'bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]'
        }`}
    >
      <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
      {label}
    </Link>
  )
}

function Sidebar() {
  return (
    <div className="w-64 h-screen bg-[var(--color-bg)] border-r border-[var(--color-text-muted)]/10 p-6 fixed left-0 top-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-mono text-[var(--color-text)] flex items-center gap-2">
          🧠 <span>KrypticTrack</span>
        </h2>
        <p className="text-[var(--color-text-muted)]/70 font-mono text-xs mt-1">
          Your productivity brain
        </p>
      </div>

      <nav className="space-y-2">
        <NavLink to="/" icon={House} label="Dashboard" />
        <NavLink to="/sessions" icon={ListBullets} label="Sessions" />
        <NavLink to="/habits" icon={CheckSquare} label="Habits" />
        <NavLink to="/goals" icon={Target} label="Goals" />
        <NavLink to="/insights" icon={Lightbulb} label="Insights" />
        <NavLink to="/settings" icon={Gear} label="Settings" />
      </nav>
    </div>
  )
}

function AppContent() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
