import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { useStats } from '../hooks/useStats'
import { usePredictions } from '../hooks/usePredictions'
import { useActions } from '../hooks/useActions'
import CountdownTimer from '../components/CountdownTimer'
import { getSourceIcon } from '../utils/sourceUtils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function Dashboard() {
  const { stats, loading: statsLoading } = useStats()
  const { prediction, loading: predLoading } = usePredictions()
  const { actions: recentActions } = useActions(100)

  // Calculate daily activity for last 7 days
  const dailyActivity = Array(7).fill(0)
  const today = new Date()
  recentActions.forEach((action: any) => {
    const actionDate = new Date(action.timestamp * 1000)
    const daysAgo = Math.floor((today.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAgo >= 0 && daysAgo < 7) {
      dailyActivity[6 - daysAgo]++
    }
  })
  
  const performanceData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Actions',
        data: dailyActivity,
        borderColor: '#a31d1d',
        backgroundColor: 'rgba(163, 29, 29, 0.1)',
        tension: 0.4,
      },
    ],
  }

  // Source distribution from stats
  const sourceLabels = stats?.actions_by_source ? Object.keys(stats.actions_by_source) : []
  const sourceValues = stats?.actions_by_source ? Object.values(stats.actions_by_source) : []
  const sourceColors = ['#6c757d', '#d4a574', '#a31d1d', '#b8935f', '#9d7a4a']
  
  const sourceData = {
    labels: sourceLabels.length > 0 ? sourceLabels.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)) : ['No Data'],
    datasets: [
      {
        data: sourceValues.length > 0 ? sourceValues : [1],
        backgroundColor: sourceColors.slice(0, sourceValues.length || 1),
        borderWidth: 0,
      },
    ],
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return Math.floor(num).toString()
  }



  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
          Dashboard
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
          Overview of your behavior patterns and productivity insights
        </p>
      </div>

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Total Actions
              </h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {statsLoading ? (
                <span className="text-gray-400">Loading...</span>
              ) : (
                formatNumber(stats?.total_actions || 0)
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Active Sources
              </h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {statsLoading ? (
                <span className="text-gray-400">Loading...</span>
              ) : (
                stats?.active_sources || 0
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Prediction Accuracy
              </h3>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {predLoading ? (
                <span className="text-gray-400">Loading...</span>
              ) : prediction?.confidence ? (
                `${Math.round(prediction.confidence * 100)}%`
              ) : (
                'N/A'
              )}
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Performance This Month
          </h2>
          <div className="h-64">
            <Line
              data={performanceData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: '#f3f4f6',
                    },
                  },
                  x: {
                    grid: {
                      display: false,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Next Action Prediction */}
        {prediction && prediction.available && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Next Action Prediction
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {prediction.predicted_action
                      ?.replace(/_/g, ' ')
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {prediction.explanation || 'Based on your behavior patterns'}
                  </div>
                </div>
                {prediction.countdown_seconds && (
                  <CountdownTimer seconds={prediction.countdown_seconds} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-700">
                  Confidence:
                </div>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-500 transition-all duration-500"
                    style={{
                      width: `${(prediction.confidence || 0) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {Math.round((prediction.confidence || 0) * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Source Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Source Distribution
            </h2>
            <div className="h-64">
              <Doughnut
                data={sourceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Recent Activity Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActions && recentActions.length > 0 ? (
                recentActions.slice(0, 5).map((action: any, idx: number) => {
                  const Icon = getSourceIcon(action.source)
                  return (
                    <div
                      key={action.id || idx}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {action.action_type
                            ?.replace(/_/g, ' ')
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(action.timestamp * 1000).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent activity. Start using your applications to see activity here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
