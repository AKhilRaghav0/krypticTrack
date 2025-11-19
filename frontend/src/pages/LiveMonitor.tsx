import { useState, useEffect, useRef } from 'react'
import { useActions } from '../hooks/useActions'
import { useStats } from '../hooks/useStats'
import { Pulse } from '@phosphor-icons/react'
import { getSourceIcon, getSourceColor, formatActionType } from '../utils/sourceUtils'

export default function LiveMonitor() {
  const { actions, loading, refetch } = useActions(20, 2000) // Poll every 2 seconds
  const { stats } = useStats() // Use stats for consistent active sources count
  const [isMonitoring, setIsMonitoring] = useState(true)
  const [newActionCount, setNewActionCount] = useState(0)
  const previousActionIds = useRef<Set<number>>(new Set())
  const [newActionIds, setNewActionIds] = useState<Set<number>>(new Set())

  // Detect new actions
  useEffect(() => {
    if (actions.length === 0) return

    const currentIds = new Set(actions.map((a: any) => a.id))
    const previous = previousActionIds.current

    // Find new actions
    const newIds = new Set(
      Array.from(currentIds).filter((id) => !previous.has(id))
    )

    if (newIds.size > 0) {
      setNewActionIds(newIds)
      setNewActionCount((prev) => prev + newIds.size)
      
      // Clear new action highlight after 3 seconds
      setTimeout(() => {
        setNewActionIds(new Set())
      }, 3000)
    }

    previousActionIds.current = currentIds
  }, [actions])

  // Auto-refresh when monitoring
  useEffect(() => {
    if (!isMonitoring) return

    const interval = setInterval(() => {
      refetch()
    }, 2000)

    return () => clearInterval(interval)
  }, [isMonitoring, refetch])


  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-100 tracking-tight mb-2">
              Live Monitor
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
              Real-time activity tracking and monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isMonitoring
                  ? 'bg-green-900/30 text-green-400 border border-green-700'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span className="text-sm font-semibold">
                {isMonitoring ? 'Monitoring' : 'Paused'}
              </span>
            </div>
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className="px-4 py-2 bg-[#a31d1d] text-white rounded-lg font-semibold hover:bg-[#7a1515] transition-all"
            >
              {isMonitoring ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Live Activity Stream */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <Pulse className="w-5 h-5" />
              Live Activity Stream
            </h2>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-400">
                {actions.length} recent actions
              </div>
              {newActionCount > 0 && (
                <div className="px-2 py-1 bg-green-900/30 text-green-400 border border-green-700 text-xs font-semibold rounded-full animate-pulse">
                  +{newActionCount} new
                </div>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="px-6 py-16 text-center text-gray-400">
                Loading live activity...
              </div>
            ) : actions.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-400">
                No activity yet. Start using your applications to see live tracking.
              </div>
            ) : (
              actions.map((action: any, idx: number) => {
                const Icon = getSourceIcon(action.source)
                const colors = getSourceColor(action.source)
                    const actionName = formatActionType(action.action_type)

                const isNew = newActionIds.has(action.id)
                
                return (
                  <div
                    key={action.id || idx}
                    className={`px-6 py-4 hover:bg-gray-700/50 transition-all ${
                      isNew
                        ? 'bg-green-900/30 border-l-4 border-green-500 animate-slide-up'
                        : 'animate-fade-in'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 ${colors} rounded-full flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-100">
                            {actionName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(action.timestamp * 1000).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            isNew
                              ? 'bg-green-500 text-white animate-pulse'
                              : 'bg-green-900/30 text-green-400 border border-green-700'
                          }`}>
                            {isNew ? 'NEW' : 'LIVE'}
                          </span>
                        </div>
                            <div className="text-xs text-gray-400">
                              Source: {action.source.toUpperCase()} •{' '}
                              {new Date(action.timestamp * 1000).toLocaleDateString()}
                              {action.source === 'system' && action.context && (
                                <span className="ml-2 text-[#a31d1d]">
                                  • {action.context.app || action.context.from_app || 'OS Activity'}
                                </span>
                              )}
                            </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Actions Today
            </div>
            <div className="text-3xl font-bold text-gray-100">
              {actions.filter(
                (a: any) =>
                  new Date(a.timestamp * 1000).toLocaleDateString() ===
                  new Date().toLocaleDateString()
              ).length}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Active Sources
            </div>
              <div className="text-3xl font-bold text-gray-100">
                {stats?.active_sources || new Set(actions.map((a: any) => a.source)).size}
              </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Last Action
            </div>
            <div className="text-sm font-semibold text-gray-100">
              {actions.length > 0
                ? new Date(actions[0].timestamp * 1000).toLocaleTimeString()
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
