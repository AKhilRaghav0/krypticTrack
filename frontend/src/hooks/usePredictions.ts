import { useState, useEffect } from 'react'
import { api } from '../services/api'

export interface Prediction {
  predicted_action: string
  confidence: number
  explanation?: string
  countdown_seconds?: number
  available: boolean
}

export function usePredictions() {
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPredictions = async () => {
      setLoading(true)
      setError(null)
      const response = await api.getPredictions(true) // Always use LLM
      
      if (response.error || !response.data) {
        setError(response.error || 'Failed to fetch predictions')
        setLoading(false)
        return
      }

      setPrediction({
        predicted_action: response.data.predicted_action || '',
        confidence: response.data.confidence || 0,
        explanation: response.data.explanation,
        countdown_seconds: response.data.countdown_seconds,
        available: response.data.available !== false,
      })
      setLoading(false)
    }

    fetchPredictions()
    const interval = setInterval(fetchPredictions, 10000) // Refresh every 10s (LLM takes longer)

    return () => clearInterval(interval)
  }, [])

  return { prediction, loading, error }
}

