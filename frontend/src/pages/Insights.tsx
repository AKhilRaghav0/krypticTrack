import { useState, useEffect } from 'react'
import { useInsights } from '../hooks/useInsights'
import { api } from '../services/api'
import { Lightbulb, Sparkle, Target, ArrowClockwise } from '@phosphor-icons/react'

export default function Insights() {
  const { insights, loading } = useInsights()
  const [llmInsight, setLlmInsight] = useState<string | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(false)

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'time_pattern':
        return Target
      case 'behavior_pattern':
        return Sparkle
      default:
        return Lightbulb
    }
  }

  const getInsightColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-50 text-green-700 border-green-200'
    if (confidence >= 0.6) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  useEffect(() => {
    // Check LLM availability
    const checkLLM = async () => {
      try {
        const response = await api.checkLLMStatus()
        if (response.data) {
          const available = response.data.available || false
          setLlmAvailable(available)
          
        } else if (response.error) {
          // If status check fails, assume unavailable
          setLlmAvailable(false)
        }
      } catch (error) {
        // If status check throws, assume unavailable
        setLlmAvailable(false)
      }
    }
    checkLLM()
    // Re-check every 30 seconds
    const interval = setInterval(checkLLM, 30000)
    return () => clearInterval(interval)
  }, [insights.length])

  const handleSurprisedMe = async () => {
    setLlmLoading(true)
    setLlmInsight(null)
    
    // Re-check LLM status when button is clicked (in case it changed)
    try {
      const statusResponse = await api.checkLLMStatus()
      if (statusResponse.data?.available) {
        setLlmAvailable(true)
      } else {
        setLlmAvailable(false)
      }
    } catch (error) {
      // Continue anyway - let the API call handle it
    }
    
    try {
      const response = await api.getSurprisedMe()
      
      // Check for error in response
      if (response.error) {
        setLlmInsight(`⚠️ ${response.error}`)
        setLlmAvailable(false)
        return
      }
      
      if (response.data) {
        if (response.data.error) {
          setLlmInsight(`⚠️ ${response.data.error}`)
          setLlmAvailable(false)
        } else if (response.data.insight) {
          setLlmInsight(response.data.insight)
          setLlmAvailable(true) // If we got an insight, LLM is available
        } else {
          setLlmInsight('⚠️ No insight generated. Please try again.')
        }
      } else {
        setLlmInsight('⚠️ Failed to generate insight. Please check LM Studio is running.')
        setLlmAvailable(false)
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to generate insight. Make sure LM Studio is running on http://localhost:1234.'
      setLlmInsight(`⚠️ ${errorMsg}`)
      setLlmAvailable(false)
    } finally {
      setLlmLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
          Insights
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
          Discovered patterns and behavioral insights from your activity data
        </p>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="text-gray-500">Loading insights...</div>
          </div>
        ) : insights.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Lightbulb className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No insights yet
            </h3>
            <p className="text-gray-600">
              Insights will appear here as we analyze your behavior patterns
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insights.map((insight: any) => {
              const Icon = getInsightIcon(insight.pattern_type)
              const colorClass = getInsightColor(insight.confidence)

              return (
                <div
                  key={insight.id}
                  className={`bg-white rounded-xl border-2 ${colorClass} shadow-sm p-6 hover:shadow-md transition-all`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {insight.pattern_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-semibold">
                          {Math.round(insight.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-gray-900 leading-relaxed">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Discovered{' '}
                    {new Date(insight.discovered_at).toLocaleDateString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Surprised Me Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkle className="w-5 h-5" />
            Surprised Me
          </h2>
          <p className="text-gray-600 mb-4">
            Get a random but true insight about your behavior powered by AI
          </p>
          <button
            onClick={handleSurprisedMe}
            disabled={llmLoading}
            className="px-4 py-2 bg-secondary-500 text-white rounded-lg font-semibold hover:bg-secondary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {llmLoading ? (
              <>
                <ArrowClockwise className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkle className="w-4 h-4" />
                Generate New Insight
              </>
            )}
          </button>
          {!llmAvailable && !llmLoading && (
            <p className="text-sm text-gray-500 mt-2">
              ⚠️ LLM service may not be available. Click the button to try anyway - it will check status automatically.
            </p>
          )}
          {llmInsight && (
            <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-gray-800 leading-relaxed">{llmInsight}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
