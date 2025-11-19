import { useState, useEffect } from 'react'
import { useActions } from '../hooks/useActions'
import { useStats } from '../hooks/useStats'
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
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { ChartBar, TrendUp, Clock } from '@phosphor-icons/react'

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

export default function Analytics() {
  const { actions } = useActions(1000)
  const { stats } = useStats()

  // Process data for charts
  const hourlyData = Array(24).fill(0)
  const dailyData = Array(7).fill(0)
  const sourceData: Record<string, number> = {}

  actions.forEach((action: any) => {
    const date = new Date(action.timestamp * 1000)
    const hour = date.getHours()
    const day = date.getDay()
    
    hourlyData[hour]++
    dailyData[day]++
    sourceData[action.source] = (sourceData[action.source] || 0) + 1
  })


  const hourlyChartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Actions',
        data: hourlyData,
        borderColor: '#a31d1d',
        backgroundColor: 'rgba(163, 29, 29, 0.1)',
        tension: 0.4,
      },
    ],
  }

  const dailyChartData = {
    labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Actions',
        data: dailyData,
        backgroundColor: '#d4a574',
        borderColor: '#b8935f',
        borderWidth: 1,
      },
    ],
  }

  const sourceChartData = {
    labels: Object.keys(sourceData).map((s) => s.toUpperCase()),
    datasets: [
      {
        data: Object.values(sourceData),
        backgroundColor: ['#6c757d', '#d4a574', '#a31d1d'],
        borderWidth: 0,
      },
    ],
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-700">
        <h1 className="text-4xl font-bold text-gray-100 tracking-tight mb-2">
          Analytics
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
          Deep dive into your behavior patterns and trends
        </p>
      </div>

      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#d4a574]/20 rounded-xl flex items-center justify-center">
                <ChartBar className="w-6 h-6 text-[#d4a574]" />
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Total Actions
            </div>
            <div className="text-3xl font-bold text-gray-100">
              {stats?.total_actions?.toLocaleString() || 0}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#a31d1d]/20 rounded-xl flex items-center justify-center">
                <TrendUp className="w-6 h-6 text-[#a31d1d]" />
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Peak Hour
            </div>
            <div className="text-3xl font-bold text-gray-100">
              {hourlyData.indexOf(Math.max(...hourlyData))}:00
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-gray-300" />
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Active Sources
            </div>
            <div className="text-3xl font-bold text-gray-100">
              {stats?.active_sources || 0}
            </div>
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-100 mb-4">
            Hourly Activity Distribution
          </h2>
          <div className="h-64">
            <Line
              data={hourlyChartData}
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
                      color: '#374151',
                    },
                    ticks: {
                      color: '#9ca3af',
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

        {/* Daily Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">
              Daily Activity Distribution
            </h2>
            <div className="h-64">
              <Bar
                data={dailyChartData}
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
                        color: '#374151',
                    },
                    ticks: {
                      color: '#9ca3af',
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9ca3af',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">
              Source Distribution
            </h2>
            <div className="h-64">
              <Doughnut
                data={sourceChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: '#9ca3af',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
