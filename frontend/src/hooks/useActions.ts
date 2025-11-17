import { useState, useEffect } from 'react'
import { api } from '../services/api'

export interface Action {
  id: number
  timestamp: number
  source: string
  action_type: string
  context: any
}

export function useActions(limit = 50, pollInterval = 10000) {
  const [actions, setActions] = useState<Action[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActions = async () => {
    setLoading(true)
    setError(null)
    const response = await api.getActions(limit)
    
    if (response.error || !response.data) {
      setError(response.error || 'Failed to fetch actions')
      setLoading(false)
      return
    }

    setActions(response.data.actions || [])
    setTotal(response.data.total || 0)
    setLoading(false)
  }

  useEffect(() => {
    fetchActions()
    const interval = setInterval(fetchActions, pollInterval)

    return () => clearInterval(interval)
  }, [limit, pollInterval])

  return { actions, total, loading, error, refetch: fetchActions }
}

