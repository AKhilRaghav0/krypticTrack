const API_URL = '/api'
const API_KEY = 'local-dev-key-change-in-production'

export interface ApiResponse<T> {
  data?: T
  error?: string
  success?: boolean
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Use provided signal or default timeout (60s for LLM, 5s for others)
      const defaultTimeout = endpoint.includes('/llm/') ? 60000 : 5000
      const signal = options.signal || AbortSignal.timeout(defaultTimeout)
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          ...options.headers,
        },
        signal,
      })

      if (!response.ok) {
        return {
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return { data, success: true }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // LLM endpoints
  async checkLLMStatus() {
    return this.request<{ available: boolean; model: string; base_url: string }>(
      '/llm/status'
    )
  }

  async sendChatMessage(message: string, intent?: string, searchResults?: any[]) {
    return this.request<{ response: string; model: string; error?: string }>('/llm/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        message,
        intent,
        search_results: searchResults || []
      }),
      signal: AbortSignal.timeout(120000), // 120s for LLM
    })
  }

  async getSurprisedMe() {
    return this.request<{ insight: string; model: string; error?: string }>('/llm/surprised-me', {
      signal: AbortSignal.timeout(120000), // 120s for LLM
    })
  }

  // Stats and actions
  async getStats() {
    return this.request<{
      total_actions: number
      active_sources: number
      recent_actions: any[]
    }>('/stats')
  }

  async getActions(limit = 50) {
    return this.request<{ actions: any[]; total: number }>(
      `/recent-actions?limit=${limit}&sort=timestamp&order=desc`
    )
  }

  async searchActions(query: string, limit = 20) {
    return this.request<{ actions: any[]; total: number }>(
      `/actions/search?q=${encodeURIComponent(query)}&limit=${limit}`
    )
  }

  // Predictions
  async getPredictions(useLLM = true) {
    return this.request<{
      predicted_action: string
      confidence: number
      explanation?: string
      countdown_seconds?: number
      available?: boolean
      llm_enabled?: boolean
    }>(`/predictions?use_llm=${useLLM}`)
  }

  // Insights
  async getInsights() {
    return this.request<{ insights: any[] }>('/insights')
  }

  // Model
  async getModelInfo() {
    return this.request<{
      loaded: boolean
      accuracy?: number
      training_status?: string
      model_path?: string
      load_time?: number
    }>('/model/info')
  }

  async getTrainingStatus() {
    return this.request<{
      status: string
      progress: number
      current_epoch?: number
      total_epochs?: number
      message?: string
      model_path?: string
      model_exists?: boolean
      metrics?: {
        loss?: number
        reward_mean?: number
        reward_std?: number
        learning_rate?: number
      }
      history?: {
        loss: number[]
        reward_mean: number[]
        reward_std: number[]
      }
      config?: {
        num_epochs: number
        learning_rate: number
        batch_size: number
      }
    }>('/model/status')
  }

  async startTraining(config?: {
    num_epochs?: number
    learning_rate?: number
    batch_size?: number
  }) {
    return this.request<{
      message: string
      status: string
      config?: {
        num_epochs: number
        learning_rate: number
        batch_size: number
      }
    }>('/train', {
      method: 'POST',
      body: JSON.stringify(config || {}),
      signal: AbortSignal.timeout(10000),
    })
  }

  async stopTraining() {
    return this.request<{ message: string; status: string }>('/train/stop', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
  }

  async getTrainingLogs() {
    return this.request<{ logs: string[] }>('/training/logs')
  }

  async listModels() {
    return this.request<{
      models: Array<{
        path: string
        name: string
        size_mb: number
        modified: number
        formatted_date: string
        is_current: boolean
      }>
    }>('/model/list')
  }

  async selectModel(modelPath: string) {
    return this.request<{ success: boolean; message: string }>('/model/select', {
      method: 'POST',
      body: JSON.stringify({ model_path: modelPath }),
    })
  }

  // Work Session endpoints
  async startWorkSession(plannedWork: string) {
    return this.request<{
      success: boolean
      session: {
        session_id: number
        date: string
        start_time: number
        planned_work: string
        status: string
      }
    }>('/work-session/start', {
      method: 'POST',
      body: JSON.stringify({ planned_work: plannedWork }),
    })
  }

  async endWorkSession(sessionId?: number) {
    return this.request<{
      success: boolean
      session: {
        session_id: number
        date: string
        start_time: number
        end_time: number
        planned_work: string
        analysis: {
          summary: string
          insights: string
          time_wasted_minutes: number
          idle_time_minutes: number
          focused_time_minutes: number
          distractions: Array<{ type: string; name: string; time_minutes: number }>
          achievements: Array<{ type: string; count: number }>
        }
      }
    }>('/work-session/end', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
      signal: AbortSignal.timeout(180000), // 3 minutes for analysis
    })
  }

  async getTodayWorkSession() {
    return this.request<{
      success: boolean
      session: {
        session_id: number
        date: string
        start_time: number
        end_time?: number
        planned_work: string
        actual_summary?: string
        time_wasted_minutes?: number
        idle_time_minutes?: number
        focused_time_minutes?: number
        distractions?: Array<any>
        achievements?: Array<any>
        insights?: string
        status: 'active' | 'completed'
      } | null
      message?: string
    }>('/work-session/today')
  }

  async getWorkSessionHistory(limit = 30) {
    return this.request<{
      success: boolean
      sessions: Array<{
        session_id: number
        date: string
        start_time: number
        end_time?: number
        planned_work: string
        actual_summary?: string
        time_wasted_minutes?: number
        idle_time_minutes?: number
        focused_time_minutes?: number
        insights?: string
      }>
      count: number
    }>(`/work-session/history?limit=${limit}`)
  }
}

export const api = new ApiService()

