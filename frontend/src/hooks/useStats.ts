import { useState, useEffect } from 'react'
import { api } from '../services/api'

export interface Stats {
  total_actions: number
  active_sources: number
  recent_actions: any[]
  actions_by_source?: Record<string, number>
}

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      setError(null)
      const response = await api.getStats()
      
      if (response.error || !response.data) {
        setError(response.error || 'Failed to fetch stats')
        setLoading(false)
        return
      }

      setStats(response.data)
      setLoading(false)
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s

    return () => clearInterval(interval)
  }, [])

  return { stats, loading, error }
}

