import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { User, PaperPlaneTilt, Plus, Trash, ChartLine, Sparkle } from '@phosphor-icons/react'
import { Line, Doughnut } from 'react-chartjs-2'
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

interface ChatMessage {
  role: 'user' | 'assistant'
  message: string
  timestamp: number
  chartData?: any
  chartType?: 'line' | 'doughnut' | 'bar'
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [llmStatus, setLlmStatus] = useState<{
    available: boolean
    model?: string
  }>({ available: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadSessions()
    checkLLMStatus()
    const interval = setInterval(checkLLMStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [currentSessionId, sessions])

  const loadSessions = () => {
    const saved = localStorage.getItem('chatSessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSessions(parsed)
        if (parsed.length > 0 && !currentSessionId) {
          setCurrentSessionId(parsed[0].id)
        }
      } catch (e) {
        console.error('Error loading sessions:', e)
      }
    } else {
      createNewChat()
    }
  }

  const saveSessions = () => {
    localStorage.setItem('chatSessions', JSON.stringify(sessions.slice(0, 50)))
  }

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [newSession, ...sessions]
    setSessions(updated)
    setCurrentSessionId(newSession.id)
    saveSessions()
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  const checkLLMStatus = async () => {
    const response = await api.checkLLMStatus()
    if (response.data) {
      setLlmStatus({
        available: response.data.available,
        model: response.data.model,
      })
    }
  }

  // Detect if message should include a chart
  const detectChartRequest = (message: string): { type?: string; data?: any } => {
    const lower = message.toLowerCase()
    if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualize')) {
      // Mock chart data - in real implementation, this would come from API
      if (lower.includes('productivity') || lower.includes('activity')) {
        return {
          type: 'line',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
              {
                label: 'Actions',
                data: [120, 190, 300, 500, 200, 300, 450],
                borderColor: '#a31d1d',
                backgroundColor: 'rgba(163, 29, 29, 0.1)',
                tension: 0.4,
              },
            ],
          },
        }
      }
      if (lower.includes('source') || lower.includes('distribution')) {
        return {
          type: 'doughnut',
          data: {
            labels: ['Chrome', 'VSCode', 'System'],
            datasets: [
              {
                data: [45, 30, 25],
                backgroundColor: ['#6c757d', '#d4a574', '#a31d1d'],
                borderWidth: 0,
              },
            ],
          },
        }
      }
    }
    return {}
  }

  const sendMessage = async (message?: string) => {
    const messageText = message || input.trim()
    if (!messageText || isTyping || !currentSessionId) return

    setInput('')
    setIsTyping(true)

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      message: messageText,
      timestamp: Date.now(),
    }

    const updatedSessions = sessions.map((s) => {
      if (s.id === currentSessionId) {
        const updated = {
          ...s,
          messages: [...s.messages, userMessage],
          updatedAt: Date.now(),
        }
        // Auto-title from first message
        if (s.messages.length === 0 && s.title === 'New Chat') {
          updated.title = messageText.substring(0, 50) + (messageText.length > 50 ? '...' : '')
        }
        return updated
      }
      return s
    })
    setSessions(updatedSessions)

    // Get AI response
    try {
      const response = await api.sendChatMessage(messageText)
      
      // Check for error in response
      if (response.error) {
        throw new Error(response.error)
      }

      // Check if response data exists and has a response
      if (response.data) {
        if (response.data.error) {
          throw new Error(response.data.error)
        }
        
        if (response.data.response) {
          const chartInfo = detectChartRequest(messageText)
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            message: response.data.response,
            timestamp: Date.now(),
            chartData: chartInfo.data,
            chartType: chartInfo.type as 'line' | 'doughnut' | 'bar',
          }

          const finalSessions = updatedSessions.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: [...s.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            }
            return s
          })
          setSessions(finalSessions)
          saveSessions()
        } else {
          throw new Error(response.data.error || 'No response from AI')
        }
      } else {
        throw new Error('No response data received')
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      
      // Extract error message
      let errorMsg = 'Sorry, I could not generate a response. Please try again.'
      
      if (error.message) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      }
      
      // Provide helpful error messages
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        errorMsg = 'Request timed out. The model is taking too long to respond. Try using a lighter/faster model or wait a bit longer.'
      } else if (errorMsg.includes('LLM service not available') || errorMsg.includes('LM Studio') || errorMsg.includes('connect')) {
        errorMsg = 'LLM service not available. Please start LM Studio on http://localhost:1234 and ensure a model is loaded.'
      }
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        message: errorMsg,
        timestamp: Date.now(),
      }
      const finalSessions = updatedSessions.map((s) => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, errorMessage],
          }
        }
        return s
      })
      setSessions(finalSessions)
      saveSessions()
    } finally {
      setIsTyping(false)
    }
  }

  const deleteSession = (id: string) => {
    if (confirm('Delete this chat?')) {
      const updated = sessions.filter((s) => s.id !== id)
      setSessions(updated)
      if (currentSessionId === id) {
        setCurrentSessionId(updated.length > 0 ? updated[0].id : null)
      }
      saveSessions()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const quickMessages = [
    { text: 'What are my most productive hours?', label: 'Productive Hours' },
    { text: 'Show me a chart of my activity', label: 'Activity Chart' },
    { text: 'Analyze my behavior patterns', label: 'Pattern Analysis' },
    { text: 'What apps do I use most?', label: 'App Usage' },
  ]

  const renderChart = (chartData: any, chartType: string) => {
    if (!chartData) return null

    if (chartType === 'line') {
      return (
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <Line
            data={chartData}
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
            style={{ height: '200px' }}
          />
        </div>
      )
    }

    if (chartType === 'doughnut') {
      return (
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <Doughnut
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                },
              },
            }}
            style={{ height: '200px' }}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 animate-fade-in">
      {/* Chat History Sidebar */}
      <div className="w-64 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full px-4 py-2.5 bg-[#a31d1d] text-white rounded-lg font-semibold hover:bg-[#7a1515] transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No chat history
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                  currentSessionId === session.id
                    ? 'bg-[#a31d1d]/20 border border-[#a31d1d]/30'
                    : 'hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-100 truncate mb-1">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(session.updatedAt).toLocaleDateString() ===
                      new Date().toLocaleDateString()
                        ? new Date(session.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : new Date(session.updatedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <div
              className={`w-2 h-2 rounded-full ${
                llmStatus.available ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span>
              {llmStatus.available
                ? `Connected (${llmStatus.model || 'local-model'})`
                : 'Not available'}
            </span>
          </div>
          <button
            onClick={() => {
              if (confirm('Delete all chat history?')) {
                setSessions([])
                setCurrentSessionId(null)
                localStorage.removeItem('chatSessions')
              }
            }}
            className="w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Trash className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4a574] to-[#a31d1d] rounded-full flex items-center justify-center text-white shadow-md">
              <Sparkle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-100">
                {currentSession?.title || 'New Chat'}
              </h3>
              <p className="text-xs text-gray-400">Behavior Analysis</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900/30">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-[#d4a574]/20 to-[#a31d1d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChartLine className="w-8 h-8 text-[#a31d1d]" />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">
                Explore your behavior patterns
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                Ask about your activity patterns, productivity insights, or get personalized suggestions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickMessages.map((qm, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(qm.text)}
                    className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-left hover:bg-gray-700 hover:border-[#a31d1d] transition-all"
                  >
                    <div className="font-semibold text-gray-100 mb-1">
                      {qm.label}
                    </div>
                    <div className="text-xs text-gray-400">{qm.text}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentSession.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-4 ${
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    } max-w-4xl w-full`}
                  >
                    {/* Avatar */}
                    {msg.role === 'user' ? (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md bg-[#a31d1d]">
                        <User className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md bg-gradient-to-br from-[#d4a574] to-[#a31d1d]">
                        <Sparkle className="w-5 h-5" />
                      </div>
                    )}

                    {/* Message Card */}
                    <div className="flex-1">
                      <div
                        className={`rounded-xl shadow-sm border ${
                          msg.role === 'user'
                            ? 'bg-[#a31d1d] text-white border-[#7a1515]'
                            : 'bg-gray-700/50 text-gray-100 border-gray-600'
                        }`}
                      >
                        <div className="p-4">
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message}
                          </div>
                          
                          {/* Chart Embedding */}
                          {msg.chartData && msg.chartType && renderChart(msg.chartData, msg.chartType)}
                        </div>
                        
                        <div
                          className={`px-4 py-2 text-xs border-t ${
                            msg.role === 'user'
                              ? 'border-secondary-600 text-secondary-100'
                              : 'border-gray-200 text-gray-500 bg-gray-50'
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-4 justify-start">
                  <div className="flex gap-4 max-w-4xl w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#d4a574] to-[#a31d1d] rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md">
                      <Sparkle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl shadow-sm inline-block">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          />
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.4s' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  rows={1}
                  placeholder="Ask about your behavior patterns..."
                  className="w-full px-4 py-3 pr-12 border border-gray-600 bg-gray-700/50 text-gray-100 rounded-lg focus:ring-2 focus:ring-[#a31d1d] focus:border-transparent resize-none overflow-hidden placeholder:text-gray-500"
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 bottom-2 w-8 h-8 bg-[#a31d1d] text-white rounded-lg flex items-center justify-center hover:bg-[#7a1515] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperPlaneTilt className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
