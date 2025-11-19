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
  Sparkle,
  Check,
  TrendUp,
  TrendDown,
  Warning,
  CheckCircle as CheckCircleIcon,
  ChartBar,
  Brain,
  Rocket,
  Target,
  Lightning,
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
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModelPath, setSelectedModelPath] = useState<string | null>(null)
  const [boomEffect, setBoomEffect] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [predictions, setPredictions] = useState<any>(null)
  const [actionTypeCounts, setActionTypeCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [modelResponse, statusResponse, modelsResponse] = await Promise.all([
          api.getModelInfo(),
          api.getTrainingStatus(),
          api.listModels(),
        ])

        if (modelResponse.data) {
          setModelInfo(modelResponse.data)
          if (modelResponse.data.model_path) {
            setSelectedModelPath(modelResponse.data.model_path)
          }
        }

        if (statusResponse.data) {
          setTrainingStatus(statusResponse.data)
          if ((statusResponse.data as any).data_sources) {
            setActionTypeCounts((statusResponse.data as any).data_sources)
          }
        }

        if (modelsResponse.data) {
          setAvailableModels(modelsResponse.data.models)
          const currentModel = modelsResponse.data.models.find((m: any) => m.is_current)
          if (currentModel && !selectedModelPath) {
            setSelectedModelPath(currentModel.path)
          }
        }

        if (modelResponse.data?.loaded) {
          try {
            const predResponse = await api.getPredictions(false)
            if (predResponse.data) {
              setPredictions(predResponse.data)
            }
          } catch (e) {
            // Silent fail
          }
        }

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
          setTrainingLogs([])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching training data:', error)
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleSelectModel = async (modelPath: string) => {
    setLoadingModels(true)
    try {
      const response = await api.selectModel(modelPath)
      if (response.error) {
        alert(`Failed to load model: ${response.error}`)
      } else {
        setSelectedModelPath(modelPath)
        setBoomEffect(modelPath)
        setTimeout(() => setBoomEffect(null), 1000)
        // Refresh model info
        const modelResponse = await api.getModelInfo()
        if (modelResponse.data) {
          setModelInfo(modelResponse.data)
        }
      }
    } catch (error) {
      console.error('Error selecting model:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const startTraining = async () => {
    try {
      const response = await api.startTraining(config)
      if (response.error) {
        alert(`Failed to start training: ${response.error}`)
      } else {
        setShowConfig(false)
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
    if (loading) return 'text-gray-400'
    if (trainingStatus?.status === 'training') return 'text-blue-400'
    if (trainingStatus?.status === 'trained' || modelInfo?.loaded) return 'text-green-400'
    return 'text-red-400'
  }

  const StatusIcon = getStatusIcon()

  // Prepare training history chart data
  const historyData = (() => {
    if (!trainingStatus?.history || trainingStatus?.status !== 'training') return null
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  // Calculate quality score
  const calculateQuality = () => {
    if (!trainingStatus || trainingStatus.status !== 'trained') return null
    
    const loss = trainingStatus.metrics?.loss
    const rewardMean = trainingStatus.metrics?.reward_mean
    const totalActions = trainingStatus.total_actions || 0
    
    if (loss === null || loss === undefined) return null
    
    let score = 100
    // Penalize high loss
    if (loss > 0.01) score -= 30
    else if (loss > 0.001) score -= 15
    // Reward good data diversity
    if (totalActions > 50000) score += 10
    else if (totalActions < 10000) score -= 20
    // Reward stable reward
    if (rewardMean !== null && rewardMean !== undefined && Math.abs(rewardMean) < 0.1) score += 10
    
    return Math.max(0, Math.min(100, score))
  }

  const qualityScore = calculateQuality()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#a31d1d] via-[#c92a2a] to-[#a31d1d] text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Brain className="w-10 h-10" weight="duotone" />
                <h1 className="text-4xl font-bold tracking-tight">Neural Model</h1>
              </div>
              <p className="text-lg text-white/90 max-w-2xl">
                Train and monitor your Inverse Reinforcement Learning model
              </p>
            </div>
            <div className="flex items-center gap-3">
              {trainingStatus?.status === 'training' ? (
                <button
                  onClick={stopTraining}
                  className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold hover:bg-white/30 transition-all flex items-center gap-2 border border-white/30"
                >
                  <Stop className="w-5 h-5" />
                  Stop Training
                </button>
              ) : (
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="px-6 py-3 bg-gray-800/50 text-[#a31d1d] border border-gray-700 rounded-xl font-semibold hover:bg-gray-700 transition-all flex items-center gap-2 shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  Train Model
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Training Configuration Modal */}
        {showConfig && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-xl p-8 macos-card">
            <h3 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <Rocket className="w-6 h-6 text-[#a31d1d]" />
              Training Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-xl focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-2">Recommended: 50-200</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-xl focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-2">Recommended: 0.001</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-xl focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-2">Recommended: 64</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-700">
              <button
                onClick={startTraining}
                className="flex-1 px-6 py-3 bg-[#a31d1d] text-white rounded-xl font-semibold hover:bg-[#7a1515] transition-all flex items-center justify-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                Start Training
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="px-6 py-3 bg-gray-700 text-gray-200 rounded-xl font-semibold hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Model Status */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-900/30 rounded-xl">
                <StatusIcon className={`w-6 h-6 ${getStatusColor()}`} />
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor().replace('text-', 'bg-').replace('-600', '-900/30').replace('text-blue-600', 'text-blue-400').replace('text-green-600', 'text-green-400')} ${getStatusColor()}`}>
                {loading
                  ? 'Loading...'
                  : trainingStatus?.status === 'training'
                    ? 'Training'
                    : trainingStatus?.status === 'trained'
                      ? 'Trained'
                      : modelInfo?.loaded
                        ? 'Loaded'
                        : 'Not Trained'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Model Status</h3>
            <p className="text-2xl font-bold text-gray-100">
              {modelInfo?.loaded ? 'Active' : 'Inactive'}
            </p>
          </div>

          {/* Training Progress */}
          {trainingStatus?.status === 'training' && (
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-900/30 rounded-xl">
                  <Gauge className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-xs font-semibold text-purple-400">{trainingStatus.progress || 0}%</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Progress</h3>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${Math.max(trainingStatus.progress || 0, 1)}%` }}
                />
              </div>
              {trainingStatus.current_epoch && trainingStatus.total_epochs && (
                <p className="text-xs text-gray-400 mt-2">
                  Epoch {trainingStatus.current_epoch} / {trainingStatus.total_epochs}
                </p>
              )}
            </div>
          )}

          {/* Quality Score */}
          {qualityScore !== null && (
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-900/30 rounded-xl">
                  <Target className="w-6 h-6 text-green-400" />
                </div>
                <span className="text-xs font-semibold text-green-400">{qualityScore}%</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Quality Score</h3>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Total Actions */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-900/30 rounded-xl">
                <Lightning className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Training Data</h3>
            <p className="text-2xl font-bold text-gray-100">
              {trainingStatus?.total_actions?.toLocaleString() || '0'}
            </p>
            <p className="text-xs text-gray-400 mt-1">actions tracked</p>
          </div>
        </div>

        {/* Model Selection */}
        {availableModels.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3 mb-6">
              <Sparkle className="w-6 h-6 text-blue-500" weight="fill" />
              Available Models
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableModels.map((model) => (
                <div
                  key={model.path}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                    model.is_current || selectedModelPath === model.path
                      ? 'border-blue-500 bg-blue-900/30 shadow-lg scale-105'
                      : 'border-gray-700 hover:border-gray-600 hover:shadow-md'
                  } ${boomEffect === model.path ? 'animate-boom' : ''}`}
                  onClick={() => handleSelectModel(model.path)}
                >
                  {boomEffect === model.path && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="text-6xl animate-ping">✨</div>
                      <div className="absolute text-4xl animate-bounce">🎉</div>
                    </div>
                  )}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-100 text-sm mb-1">
                          {model.formatted_date}
                        </div>
                        <div className="text-xs text-gray-400">
                          {model.size_mb} MB
                        </div>
                      </div>
                      {(model.is_current || selectedModelPath === model.path) && (
                        <div className="flex items-center gap-1 text-blue-400">
                          <Check className="w-5 h-5" weight="fill" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Training Metrics - Only show when training */}
        {trainingStatus?.status === 'training' && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <ChartLine className="w-6 h-6 text-[#a31d1d]" />
              Live Training Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Loss</div>
                <div className="text-2xl font-bold text-red-900">
                  {trainingStatus?.metrics?.loss !== undefined && trainingStatus.metrics.loss !== null
                    ? Number(trainingStatus.metrics.loss).toFixed(6)
                    : '—'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Reward μ</div>
                <div className="text-2xl font-bold text-blue-900">
                  {trainingStatus?.metrics?.reward_mean !== undefined && trainingStatus.metrics.reward_mean !== null
                    ? Number(trainingStatus.metrics.reward_mean).toFixed(4)
                    : '—'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">Reward σ</div>
                <div className="text-2xl font-bold text-purple-900">
                  {trainingStatus?.metrics?.reward_std !== undefined && trainingStatus.metrics.reward_std !== null
                    ? Number(trainingStatus.metrics.reward_std).toFixed(4)
                    : '—'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Learning Rate</div>
                <div className="text-2xl font-bold text-green-900">
                  {trainingStatus?.metrics?.learning_rate || trainingStatus?.config?.learning_rate || config.learning_rate}
                </div>
              </div>
            </div>

            {/* Training History Chart */}
            {historyData && historyData.datasets[0].data.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-bold text-gray-100 mb-4">Training History</h4>
                <div className="h-64">
                  <Line data={historyData} options={chartOptions} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Predictions Preview */}
        {predictions && predictions.available && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" weight="duotone" />
              Next Action Prediction
            </h3>
            {predictions.top_3 && Array.isArray(predictions.top_3) && predictions.top_3.length > 0 ? (
              <div className="space-y-3">
                {predictions.top_3.map((pred: any, idx: number) => {
                  const percentage = Math.round((pred.reward / (predictions.top_3[0]?.reward || 1)) * 100)
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl border border-gray-600">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-gray-400">{idx + 1}.</span>
                        <span className="font-semibold text-gray-100 text-lg">
                          {pred.action_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-16 text-right">{percentage}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : predictions.predicted_action ? (
              <div className="p-4 bg-gray-700/50 rounded-xl border border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-100 text-lg">
                    {predictions.predicted_action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                  <span className="text-sm font-bold text-gray-300">
                    {Math.round((predictions.confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No predictions available</p>
            )}
            {predictions.explanation && (
              <div className="mt-4 p-4 bg-blue-900/30 rounded-xl border border-blue-700">
                <p className="text-sm text-gray-100">{predictions.explanation}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Types */}
        {Object.keys(actionTypeCounts).length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <ChartBar className="w-6 h-6 text-indigo-500" />
              Action Types in Training Data
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(actionTypeCounts)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 12)
                .map(([actionType, count]: [string, any]) => {
                  const colors: Record<string, string> = {
                    'file_access': 'cyan',
                    'scroll': 'yellow',
                    'activity': 'green',
                    'text_select': 'blue',
                    'keystroke': 'magenta',
                    'tab_switch': 'blue',
                    'tab_visit': 'cyan',
                    'mouse_click': 'purple',
                    'file_edit': 'green',
                    'terminal_command': 'orange',
                  }
                  const color = colors[actionType.toLowerCase()] || 'gray'
                  const colorClasses: Record<string, string> = {
                    cyan: 'text-cyan-400 bg-cyan-900/30 border-cyan-700',
                    yellow: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
                    green: 'text-green-400 bg-green-900/30 border-green-700',
                    blue: 'text-blue-400 bg-blue-900/30 border-blue-700',
                    magenta: 'text-pink-400 bg-pink-900/30 border-pink-700',
                    purple: 'text-purple-400 bg-purple-900/30 border-purple-700',
                    orange: 'text-orange-400 bg-orange-900/30 border-orange-700',
                    gray: 'text-gray-300 bg-gray-700/50 border-gray-600',
                  }
                  return (
                    <div
                      key={actionType}
                      className={`p-3 rounded-lg border-2 ${colorClasses[color] || colorClasses.gray}`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {actionType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-lg font-bold">{count.toLocaleString()}</div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Neural Network Visualization */}
        {modelInfo?.loaded && (
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-lg p-6 macos-card">
            <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" weight="duotone" />
              Model Architecture
            </h3>
            <NeuralNetworkViz />
          </div>
        )}
      </div>
    </div>
  )
}
