import { useState, useEffect } from 'react'
import { api } from '../services/api'

export interface Insight {
  id: number
  discovered_at: string
  pattern_type: string
  description: string
  confidence: number
  evidence: any
}

export function useInsights() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true)
      setError(null)
      const response = await api.getInsights()
      
      if (response.error || !response.data) {
        setError(response.error || 'Failed to fetch insights')
        setLoading(false)
        return
      }

      setInsights(response.data.insights || [])
      setLoading(false)
    }

    fetchInsights()
    const interval = setInterval(fetchInsights, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [])

  return { insights, loading, error }
}

