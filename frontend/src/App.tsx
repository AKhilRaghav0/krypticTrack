import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import LiveMonitor from './pages/LiveMonitor'
import Insights from './pages/Insights'
import ModelStatus from './pages/ModelStatus'
import Analytics from './pages/Analytics'
import Activity from './pages/Activity'
import Chat from './pages/Chat'
import Settings from './pages/Settings'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/live" element={<LiveMonitor />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/model" element={<ModelStatus />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/chat" element={<Chat />} />
            {/* Chat is now floating, but keep route for direct navigation */}
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
