import { useState, useEffect } from 'react'
import { api } from '../services/api'
import NeuralNetworkViz from '../components/NeuralNetworkViz'
import {
  Play,
  Stop,
  CheckCircle,
  XCircle,
  Hourglass,
  ChartLine,
  Gauge,
  Clock,
  FileArrowDown,
} from '@phosphor-icons/react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function ModelStatus() {
  const [modelInfo, setModelInfo] = useState<{
    loaded: boolean
    accuracy?: number
    training_status?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [trainingStatus, setTrainingStatus] = useState<any>(null)
  const [trainingLogs, setTrainingLogs] = useState<(string | { message?: string; text?: string; timestamp?: number })[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState({
    num_epochs: 50,
    learning_rate: 0.001,
    batch_size: 64,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [modelResponse, statusResponse] = await Promise.all([
          api.getModelInfo(),
          api.getTrainingStatus(),
        ])

        if (modelResponse.data) {
          setModelInfo(modelResponse.data)
        }

        if (statusResponse.data) {
          setTrainingStatus(statusResponse.data)
        }

        // Fetch logs if training, clear if not
        if (statusResponse.data?.status === 'training') {
          try {
            const logsResponse = await api.getTrainingLogs()
            if (logsResponse.data?.logs) {
              setTrainingLogs(logsResponse.data.logs)
            }
          } catch (error) {
            // Silent fail for logs
          }
        } else if (statusResponse.data?.status !== 'training' && trainingLogs.length > 0) {
          // Clear logs when training stops
          setTrainingLogs([])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching training data:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000) // Poll every 2s
    return () => clearInterval(interval)
  }, [])

  const startTraining = async () => {
    try {
      const response = await api.startTraining(config)
      if (response.error) {
        alert(`Failed to start training: ${response.error}`)
      } else {
        setShowConfig(false)
        // Reset local state immediately for clean start
        setTrainingLogs([])
        setTrainingStatus({
          status: 'queued',
          progress: 0,
          message: 'Starting training...',
          metrics: { loss: null, reward_mean: null, reward_std: null, learning_rate: config.learning_rate },
          history: { loss: [], reward_mean: [], reward_std: [] },
          config: {
            num_epochs: config.num_epochs,
            learning_rate: config.learning_rate,
            batch_size: config.batch_size,
          },
        })
        // Refresh status after a brief delay
        setTimeout(() => {
          const fetchStatus = async () => {
            const statusResponse = await api.getTrainingStatus()
            if (statusResponse.data) {
              setTrainingStatus(statusResponse.data)
            }
          }
          fetchStatus()
        }, 500)
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to start training'}`)
    }
  }

  const stopTraining = async () => {
    if (!confirm('Stop training? Progress will be lost.')) return

    try {
      const response = await api.stopTraining()
      if (response.error) {
        alert(`Failed to stop training: ${response.error}`)
      } else {
        // Reset local state immediately for better UX
        setTrainingLogs([])
        setTrainingStatus((prev) => ({
          ...prev,
          status: 'stopped',
          progress: 0,
          message: 'Training stopped',
          metrics: { loss: null, reward_mean: null, reward_std: null, learning_rate: null },
          history: { loss: [], reward_mean: [], reward_std: [] },
        }))
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to stop training'}`)
    }
  }

  const getStatusIcon = () => {
    if (loading) return Hourglass
    if (trainingStatus?.status === 'training') return Hourglass
    if (trainingStatus?.status === 'trained' || modelInfo?.loaded) return CheckCircle
    return XCircle
  }

  const getStatusColor = () => {
    if (loading) return 'text-gray-500'
    if (trainingStatus?.status === 'training') return 'text-blue-600'
    if (trainingStatus?.status === 'trained' || modelInfo?.loaded) return 'text-green-600'
    return 'text-red-600'
  }

  const StatusIcon = getStatusIcon()

  // Prepare training history chart data
  const historyData = (() => {
    if (!trainingStatus?.history) return null
    const loss = trainingStatus.history.loss || []
    const reward_mean = trainingStatus.history.reward_mean || []
    if (loss.length === 0 && reward_mean.length === 0) return null
    
    const maxLength = Math.max(loss.length, reward_mean.length)
    return {
      labels: Array.from({ length: maxLength }, (_, i) => `Epoch ${i + 1}`),
      datasets: [
        {
          label: 'Loss',
          data: loss,
          borderColor: '#a31d1d',
          backgroundColor: 'rgba(163, 29, 29, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Reward Mean',
          data: reward_mean,
          borderColor: '#d4a574',
          backgroundColor: 'rgba(212, 165, 116, 0.1)',
          tension: 0.4,
        },
      ],
    }
  })()

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
              Model Training
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
              Train and monitor your IRL model performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            {trainingStatus?.status === 'training' ? (
              <button
                onClick={stopTraining}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all flex items-center gap-2"
              >
                <Stop className="w-5 h-5" />
                Stop Training
              </button>
            ) : (
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="px-6 py-3 bg-secondary-500 text-white rounded-lg font-semibold hover:bg-secondary-600 transition-all flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Train Model
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Training Configuration Modal */}
        {showConfig && (
          <div className="bg-white rounded-xl border-2 border-secondary-200 shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Training Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Epochs
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={config.num_epochs}
                  onChange={(e) =>
                    setConfig({ ...config, num_epochs: parseInt(e.target.value) || 50 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 50-200</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Learning Rate
                </label>
                <input
                  type="number"
                  min="0.0001"
                  max="0.1"
                  step="0.0001"
                  value={config.learning_rate}
                  onChange={(e) =>
                    setConfig({ ...config, learning_rate: parseFloat(e.target.value) || 0.001 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 0.001</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Batch Size
                </label>
                <input
                  type="number"
                  min="1"
                  max="512"
                  value={config.batch_size}
                  onChange={(e) =>
                    setConfig({ ...config, batch_size: parseInt(e.target.value) || 64 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 64</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={startTraining}
                  className="flex-1 px-4 py-2.5 bg-secondary-500 text-white rounded-lg font-semibold hover:bg-secondary-600 transition-all"
                >
                  Start Training
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Training Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <Gauge className="w-6 h-6" />
              Training Status
            </h2>
            <div className={`flex items-center gap-2 ${getStatusColor()}`}>
              <StatusIcon className="w-5 h-5" />
              <span className="font-semibold">
                {loading
                  ? 'Loading...'
                  : trainingStatus?.status === 'training'
                    ? 'Training'
                    : trainingStatus?.status === 'trained'
                      ? 'Trained'
                      : modelInfo?.loaded
                        ? 'Model Loaded'
                        : 'Not Trained'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {(trainingStatus?.status === 'training' || trainingStatus?.status === 'queued') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {trainingStatus.message || 'Training in progress...'}
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {trainingStatus.progress || 0}%
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary-500 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(trainingStatus.progress || 0, 1)}%` }}
                />
              </div>
              {trainingStatus.current_epoch && trainingStatus.total_epochs && (
                <div className="text-xs text-gray-500 mt-1">
                  Epoch {trainingStatus.current_epoch} of {trainingStatus.total_epochs}
                </div>
              )}
            </div>
          )}
          
          {/* Stopped/Error Message */}
          {trainingStatus?.status === 'stopped' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-semibold text-red-700">
                Training was stopped
              </div>
              <div className="text-xs text-red-600 mt-1">
                {trainingStatus.message || 'Training stopped by user'}
              </div>
            </div>
          )}
          
          {trainingStatus?.status === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-semibold text-red-700">
                Training Error
              </div>
              <div className="text-xs text-red-600 mt-1">
                {trainingStatus.error || trainingStatus.message || 'An error occurred during training'}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Accuracy
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {modelInfo?.accuracy
                  ? `${Math.round(modelInfo.accuracy * 100)}%`
                  : trainingStatus?.status === 'training'
                    ? 'Training...'
                    : 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Current Loss
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {trainingStatus?.status === 'training' && trainingStatus?.metrics?.loss !== undefined && trainingStatus.metrics.loss !== null
                  ? Number(trainingStatus.metrics.loss).toFixed(4)
                  : trainingStatus?.status === 'training'
                    ? '—'
                    : 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Model State
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {trainingStatus?.model_exists || modelInfo?.loaded ? 'Ready' : 'Not Ready'}
              </div>
            </div>
          </div>

          {/* Training Metrics - Show when training is active */}
          {(trainingStatus?.status === 'training' || trainingStatus?.status === 'queued') && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Training Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 border border-primary-200">
                  <div className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-1">
                    Learning Rate
                  </div>
                  <div className="text-2xl font-bold text-primary-900">
                    {trainingStatus?.metrics?.learning_rate || trainingStatus?.config?.learning_rate || config.learning_rate}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-lg p-4 border border-secondary-200">
                  <div className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1">
                    Current Loss
                  </div>
                  <div className="text-2xl font-bold text-secondary-900">
                    {trainingStatus?.metrics?.loss !== undefined && trainingStatus.metrics.loss !== null
                      ? Number(trainingStatus.metrics.loss).toFixed(4)
                      : '—'}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 border border-primary-200">
                  <div className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-1">
                    Reward Mean
                  </div>
                  <div className="text-2xl font-bold text-primary-900">
                    {trainingStatus?.metrics?.reward_mean !== undefined && trainingStatus.metrics.reward_mean !== null
                      ? Number(trainingStatus.metrics.reward_mean).toFixed(4)
                      : '—'}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-tertiary-50 to-tertiary-100 rounded-lg p-4 border border-tertiary-200">
                  <div className="text-xs font-semibold text-tertiary-700 uppercase tracking-wider mb-1">
                    Reward Std
                  </div>
                  <div className="text-2xl font-bold text-tertiary-900">
                    {trainingStatus?.metrics?.reward_std !== undefined && trainingStatus.metrics.reward_std !== null
                      ? Number(trainingStatus.metrics.reward_std).toFixed(4)
                      : '—'}
                  </div>
                </div>
              </div>
              
              {/* Live Updates Indicator */}
              {trainingStatus?.status === 'training' && (
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live metrics updating every 2 seconds</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Training History Chart */}
        {historyData && historyData.datasets[0].data.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ChartLine className="w-5 h-5" />
              Training History
            </h3>
            <div className="h-64">
              <Line
                data={historyData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
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
        )}

        {/* Training Logs */}
        {trainingStatus?.status === 'training' && trainingLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Training Logs
            </h3>
            <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
              {trainingLogs.slice(-50).map((log, idx) => {
                // Handle both string and object log formats
                const logText = typeof log === 'string' 
                  ? log 
                  : log?.message || log?.text || JSON.stringify(log)
                return (
                  <div key={idx} className="mb-1">
                    {logText}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Model Information */}
        {trainingStatus?.model_path && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileArrowDown className="w-5 h-5" />
              Model File
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-mono text-gray-700 break-all">
                {trainingStatus.model_path}
              </div>
            </div>
          </div>
        )}

        {/* Neural Network Visualization */}
        <NeuralNetworkViz />
      </div>
    </div>
  )
}

