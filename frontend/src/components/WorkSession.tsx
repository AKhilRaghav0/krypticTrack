import { useState, useEffect } from 'react'
import { Play, Stop, Clock, Target, TrendDown, TrendUp, XCircle, CheckCircle } from '@phosphor-icons/react'
import { api } from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface WorkSessionData {
  session_id: number
  date: string
  start_time: number
  end_time?: number
  planned_work: string
  actual_summary?: string
  time_wasted_minutes?: number
  idle_time_minutes?: number
  focused_time_minutes?: number
  distractions?: Array<{ type: string; name: string; time_minutes: number }>
  achievements?: Array<{ type: string; count: number }>
  insights?: string
  status: 'active' | 'completed'
}

export default function WorkSession() {
  const [session, setSession] = useState<WorkSessionData | null>(null)
  const [plannedWork, setPlannedWork] = useState('')
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    fetchTodaySession()
  }, [])

  const fetchTodaySession = async () => {
    try {
      const response = await api.getTodayWorkSession()
      if (response.data?.session) {
        setSession(response.data.session)
        setShowInput(false)
      } else {
        setShowInput(true)
      }
    } catch (error) {
      console.error('Failed to fetch work session:', error)
    }
  }

  const handleStart = async () => {
    if (!plannedWork.trim()) return

    setLoading(true)
    try {
      const response = await api.startWorkSession(plannedWork.trim())
      if (response.data?.session) {
        const sessionData: WorkSessionData = {
          session_id: response.data.session.session_id,
          date: response.data.session.date,
          start_time: response.data.session.start_time,
          planned_work: response.data.session.planned_work,
          status: 'active' as const,
        }
        setSession(sessionData)
        setPlannedWork('')
        setShowInput(false)
      }
    } catch (error) {
      console.error('Failed to start work session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnd = async () => {
    if (!session) return

    setLoading(true)
    try {
      const response = await api.endWorkSession(session.session_id)
      if (response.data?.session) {
        const analysisSession: WorkSessionData = {
          session_id: response.data.session.session_id,
          date: response.data.session.date,
          start_time: response.data.session.start_time,
          end_time: response.data.session.end_time,
          planned_work: response.data.session.planned_work,
          status: 'completed',
          actual_summary: response.data.session.analysis?.summary,
          time_wasted_minutes: response.data.session.analysis?.time_wasted_minutes,
          idle_time_minutes: response.data.session.analysis?.idle_time_minutes,
          focused_time_minutes: response.data.session.analysis?.focused_time_minutes,
          distractions: response.data.session.analysis?.distractions,
          achievements: response.data.session.analysis?.achievements,
          insights: response.data.session.analysis?.insights,
        }
        setSession(analysisSession)
      }
    } catch (error) {
      console.error('Failed to end work session:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getElapsedTime = () => {
    if (!session?.start_time) return '0m'
    const minutes = (Date.now() / 1000 - session.start_time) / 60
    return formatTime(minutes)
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 mb-1">Work Session</h2>
          <p className="text-sm text-gray-400">Track your daily work goals and productivity</p>
        </div>
        {session?.status === 'active' && (
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Active</span>
          </div>
        )}
      </div>

      {showInput && !session && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              What are you planning to work on today?
            </label>
            <textarea
              value={plannedWork}
              onChange={(e) => setPlannedWork(e.target.value)}
              placeholder="e.g., Implement user authentication, fix bug in payment module, write API documentation..."
              className="w-full px-4 py-3 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-xl focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent resize-none placeholder:text-gray-500"
              rows={3}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={loading || !plannedWork.trim()}
            className="w-full px-6 py-3 bg-[#a31d1d] text-white rounded-xl font-semibold hover:bg-[#7a1515] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" weight="fill" />
            {loading ? 'Starting...' : 'Start Work Session'}
          </button>
        </div>
      )}

      {session?.status === 'active' && (
        <div className="space-y-4">
          <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-1">Today's Plan</h3>
                <p className="text-gray-300">{session.planned_work}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Elapsed Time</div>
                <div className="text-xl font-bold text-[#d4a574]">{getElapsedTime()}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleEnd}
            disabled={loading}
            className="w-full px-6 py-3 bg-[#a31d1d] text-white rounded-xl font-semibold hover:bg-[#7a1515] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Stop className="w-5 h-5" weight="fill" />
            {loading ? 'Analyzing...' : 'End Session & Get Analysis'}
          </button>
        </div>
      )}

      {session?.status === 'completed' && session.end_time && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
            <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#d4a574]" />
              Planned vs Actual
            </h3>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-400 mb-1">Planned</div>
                <p className="text-gray-200">{session.planned_work}</p>
              </div>
              {session.actual_summary && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Actual</div>
                  <p className="text-gray-200">{session.actual_summary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <TrendUp className="w-4 h-4 text-green-400" />
                <div className="text-xs text-gray-400">Focused</div>
              </div>
              <div className="text-xl font-bold text-green-400">
                {formatTime(session.focused_time_minutes || 0)}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <TrendDown className="w-4 h-4 text-red-400" />
                <div className="text-xs text-gray-400">Wasted</div>
              </div>
              <div className="text-xl font-bold text-red-400">
                {formatTime(session.time_wasted_minutes || 0)}
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <div className="text-xs text-gray-400">Idle</div>
              </div>
              <div className="text-xl font-bold text-yellow-400">
                {formatTime(session.idle_time_minutes || 0)}
              </div>
            </div>
          </div>

          {/* Distractions */}
          {session.distractions && session.distractions.length > 0 && (
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Top Distractions
              </h3>
              <div className="space-y-2">
                {session.distractions.slice(0, 5).map((distraction, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{distraction.name}</span>
                    <span className="text-red-400 font-semibold">
                      {formatTime(distraction.time_minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {session.achievements && session.achievements.length > 0 && (
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <h3 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Achievements
              </h3>
              <div className="space-y-2">
                {session.achievements.map((achievement, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 capitalize">
                      {achievement.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-green-400 font-semibold">{achievement.count} times</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {session.insights && (
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
              <h3 className="text-lg font-semibold text-gray-100 mb-3">Daily Insights</h3>
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="text-gray-200"
                  components={{
                    p: ({ children }) => <p className="mb-2 text-gray-200">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 text-gray-200">{children}</ul>
                    ),
                    li: ({ children }) => <li className="text-gray-200">{children}</li>,
                  }}
                >
                  {session.insights}
                </ReactMarkdown>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setSession(null)
              setShowInput(true)
            }}
            className="w-full px-6 py-3 bg-gray-700 text-gray-200 rounded-xl font-semibold hover:bg-gray-600 transition-all"
          >
            Start New Session
          </button>
        </div>
      )}
    </div>
  )
}

