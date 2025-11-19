import { useState, useEffect, useRef, useCallback } from 'react'
import { X, PaperPlaneTilt, Robot, User, Trash, Plus, ChatCircle } from '@phosphor-icons/react'
import { api } from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

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

interface FloatingChatProps {
  isOpen: boolean
  onClose: () => void
}

export default function FloatingChat({ isOpen, onClose }: FloatingChatProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [llmStatus, setLlmStatus] = useState<{ available: boolean; model?: string }>({ available: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadSessions()
      checkLLMStatus()
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [currentSessionId, sessions])

  useEffect(() => {
    const interval = setInterval(checkLLMStatus, 30000)
    return () => clearInterval(interval)
  }, [])

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
        createNewChat()
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

  const checkLLMStatus = async () => {
    const status = await api.checkLLMStatus()
    setLlmStatus({
      available: status.data?.available ?? false,
      model: status.data?.model,
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isTyping) return

    const currentSession = sessions.find(s => s.id === currentSessionId)
    if (!currentSession) return

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      message: trimmed,
      timestamp: Date.now(),
    }

    const updatedMessages = [...currentSession.messages, userMessage]
    const updatedSession = {
      ...currentSession,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: currentSession.messages.length === 0 ? trimmed.slice(0, 30) : currentSession.title,
    }

    const updatedSessions = sessions.map(s => s.id === currentSessionId ? updatedSession : s)
    setSessions(updatedSessions)
    setInput('')
    setIsTyping(true)

    // Get AI response
    try {
      const response = await api.sendChatMessage(trimmed)
      if (response.data?.response) {
        // Clean redacted reasoning from response (model thinking parts)
        let cleanResponse = response.data.response
        if (cleanResponse) {
          cleanResponse = cleanResponse
            .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
            .replace(/<think>[\s\S]*?$/gi, '')
            .trim()
        }
        
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          message: cleanResponse,
          timestamp: Date.now(),
        }
        const finalMessages = [...updatedMessages, assistantMessage]
        const finalSession = {
          ...updatedSession,
          messages: finalMessages,
          updatedAt: Date.now(),
        }
        const finalSessions = updatedSessions.map(s => s.id === currentSessionId ? finalSession : s)
        setSessions(finalSessions)
        saveSessions()
      } else if (response.error) {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          message: `Sorry, I encountered an error: ${response.error}. Please try again.`,
          timestamp: Date.now(),
        }
        const finalMessages = [...updatedMessages, errorMessage]
        const finalSession = {
          ...updatedSession,
          messages: finalMessages,
          updatedAt: Date.now(),
        }
        const finalSessions = updatedSessions.map(s => s.id === currentSessionId ? finalSession : s)
        setSessions(finalSessions)
        saveSessions()
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        message: 'Sorry, I encountered an error. Please make sure the backend is running.',
        timestamp: Date.now(),
      }
      const finalMessages = [...updatedMessages, errorMessage]
      const finalSession = {
        ...updatedSession,
        messages: finalMessages,
        updatedAt: Date.now(),
      }
      const finalSessions = updatedSessions.map(s => s.id === currentSessionId ? finalSession : s)
      setSessions(finalSessions)
      saveSessions()
    } finally {
      setIsTyping(false)
    }
  }

  const deleteSession = (sessionId: string) => {
    const updated = sessions.filter(s => s.id !== sessionId)
    setSessions(updated)
    if (currentSessionId === sessionId) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : null)
    }
    saveSessions()
  }

  const currentSession = sessions.find(s => s.id === currentSessionId)

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        ref={chatContainerRef}
        className="w-full max-w-md liquid-glass rounded-t-3xl shadow-2xl border-t border-x border-white/20 flex flex-col pointer-events-auto floating-chat-container"
        style={{ 
          maxHeight: '85vh',
          height: currentSession?.messages.length === 0 ? '500px' : 'auto',
          minHeight: '400px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20 bg-white/5 backdrop-blur-sm rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#d4a574] flex items-center justify-center">
              <Robot className="w-5 h-5 text-white" weight="fill" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Assistant</h3>
              <p className="text-xs text-gray-300">
                {llmStatus.available ? `Connected • ${llmStatus.model || 'LLM'}` : 'Offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createNewChat}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 floating-chat-scroll min-h-0">
          {currentSession?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center text-gray-300 px-4">
              <ChatCircle className="w-16 h-16 mb-4 text-[#d4a574]" weight="duotone" />
              <p className="text-sm font-medium text-white mb-2">Start a conversation</p>
              <p className="text-xs text-gray-400 mb-4">Ask about your behavior patterns, commands, or insights</p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => setInput("What commands did I use recently?")}
                  className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-colors border border-white/10"
                >
                  💻 What commands did I use recently?
                </button>
                <button
                  onClick={() => setInput("Show me my productivity patterns")}
                  className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-colors border border-white/10"
                >
                  📊 Show me my productivity patterns
                </button>
                <button
                  onClick={() => setInput("What was my last git commit?")}
                  className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-colors border border-white/10"
                >
                  🔧 What was my last git commit?
                </button>
              </div>
            </div>
          )}
          
          {currentSession?.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#d4a574] flex items-center justify-center flex-shrink-0">
                  <Robot className="w-4 h-4 text-white" weight="fill" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#d4a574] text-white rounded-br-sm'
                    : 'bg-white/10 text-gray-200 rounded-bl-sm border border-white/10'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.message}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                )}
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 border border-white/20">
                  <User className="w-4 h-4 text-white" weight="fill" />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-[#d4a574] flex items-center justify-center flex-shrink-0">
                <Robot className="w-4 h-4 text-white" weight="fill" />
              </div>
              <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3 border border-white/10">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-[#d4a574] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#d4a574] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#d4a574] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/20 bg-white/5 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask about your behavior, commands, or insights..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-white/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:border-transparent bg-white/10 text-white placeholder-gray-400"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping || !llmStatus.available}
              className="p-3 bg-[#d4a574] text-white rounded-xl hover:bg-[#c49564] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <PaperPlaneTilt className="w-5 h-5" />
            </button>
          </div>
          {!llmStatus.available && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
              <Robot className="w-3 h-3" />
              LLM is offline. Please start the backend with LLM service.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

