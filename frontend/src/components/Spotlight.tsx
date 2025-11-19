import { useState, useEffect, useRef, useCallback } from 'react'
import { MagnifyingGlass, Command, X, Sparkle, Terminal, Globe, Code, Warning, ArrowClockwise, Robot, CaretRight } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api } from '../services/api'

interface SpotlightResult {
  type: 'command' | 'action' | 'answer'
  title: string
  description: string
  action?: () => void
  metadata?: any
}

export default function Spotlight() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotlightResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [detailResult, setDetailResult] = useState<SpotlightResult | null>(null)
  const [llmReady, setLlmReady] = useState<boolean | null>(null)
  const [llmMessage, setLlmMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [isReloading, setIsReloading] = useState(false)
  const [currentModel, setCurrentModel] = useState<{ path?: string; date?: string } | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const resultsCache = useRef<Map<string, SpotlightResult[]>>(new Map())
  const listRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastQueryKeyRef = useRef<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const createAnswerResult = useCallback(
    (title: string, description: string): SpotlightResult => ({
      type: 'answer',
      title,
      description,
    }),
    []
  )

  const cacheResults = useCallback((key: string, value: SpotlightResult[]) => {
    resultsCache.current.set(key, value)
    if (resultsCache.current.size > 25) {
      const oldestKey = resultsCache.current.keys().next().value
      resultsCache.current.delete(oldestKey)
    }
  }, [])

  const searchActions = useCallback(async (q: string): Promise<SpotlightResult[]> => {
    const normalized = q.toLowerCase().trim()
    if (resultsCache.current.has(normalized)) {
      return resultsCache.current.get(normalized)!
    }

    try {
      const response = await api.searchActions(q)
      if (response.data?.actions) {
        const spotlightResults: SpotlightResult[] = response.data.actions.map((action: any) => {
          const context = action.context || {}
          let title = action.action_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Action'
          let description = ''

          if (context.command) {
            title = context.command
            description = `Terminal command from ${action.source}`
          } else if (context.url) {
            title = context.url
            description = `Browser visit from ${action.source}`
          } else if (context.file_path) {
            title = context.file_path.split('/').pop() || 'File'
            description = `File access from ${action.source}`
          } else {
            description = `Action from ${action.source}`
          }

          return {
            type: context.command ? 'command' : 'action',
            title,
            description,
            metadata: {
              ...action,
              timestamp: action.timestamp,
              source: action.source,
              context,
            },
          }
        })
        cacheResults(normalized, spotlightResults)
        return spotlightResults
      }
    } catch (error) {
      console.error('Search error:', error)
    }
    return []
  }, [cacheResults])

  const detectIntent = useCallback((query: string): string => {
    const q = query.toLowerCase()
    if (q.includes('when') || q.includes('time') || q.includes('last') || q.includes('recent')) {
      return 'timeline'
    }
    if (q.includes('predict') || q.includes('next') || q.includes('will')) {
      return 'prediction'
    }
    if (q.includes('why') || q.includes('how') || q.includes('explain')) {
      return 'reflection'
    }
    if (q.includes('command') || q.includes('git') || q.includes('bash') || q.includes('terminal')) {
      return 'command'
    }
    return 'general'
  }, [])

  // Check LLM status
  useEffect(() => {
    const checkLLM = async () => {
      try {
        const status = await api.checkLLMStatus()
        setLlmReady(status.data?.available || false)
      } catch {
        setLlmReady(false)
      }
    }
    checkLLM()
    const interval = setInterval(checkLLM, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch current model info
  useEffect(() => {
    const fetchModel = async () => {
      try {
        const modelInfo = await api.getModelInfo()
        if (modelInfo.data?.model_path) {
          const modelPath = modelInfo.data.model_path
          const match = modelPath.match(/reward_model_(\d{8})_(\d{6})/)
          if (match) {
            const [, date, time] = match
            const year = date.substring(0, 4)
            const month = date.substring(4, 6)
            const day = date.substring(6, 8)
            const hour = time.substring(0, 2)
            const minute = time.substring(2, 4)
            setCurrentModel({ date: `${year}-${month}-${day} ${hour}:${minute}` })
          }
        }
      } catch (e) {
        // Silent fail
      }
    }
    fetchModel()
    const interval = setInterval(fetchModel, 60000)
    return () => clearInterval(interval)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setIsExpanded(false) // Start collapsed
      }
      if (e.key === 'Escape' && isOpen) {
        closeSpotlight()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const closeSpotlight = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    setDetailResult(null)
    setIsExpanded(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setIsExpanded(false)
    }
  }, [isOpen])

  // Search logic with debouncing
  useEffect(() => {
    if (!isOpen) return

    const trimmed = query.trim()
    const normalizedQuery = trimmed.toLowerCase()

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    // Expand when typing
    if (trimmed.length > 2) {
      setIsExpanded(true)
    } else if (trimmed.length === 0) {
      setIsExpanded(false)
      setResults([])
      return
    }

    // Wait for user to stop typing - increased delay for relax period
    debounceTimeoutRef.current = setTimeout(async () => {
      if (signal.aborted) return
      
      setLoading(true)
      setIsThinking(true)
      try {
        // Always fetch search results first to pass to LLM for better context
        let searchResults: any[] = []
        if (!signal.aborted) {
          try {
            searchResults = await searchActions(trimmed)
          } catch (e) {
            // Silent fail
          }
        }

        let llmResponseHandled = false
        if (llmReady !== false && searchResults.length > 0) {
          try {
            const intent = detectIntent(trimmed)
            setIsThinking(true) // Show thinking indicator
            const response = await api.sendChatMessage(trimmed, intent, searchResults)
            setIsThinking(false)
            if (signal.aborted) return
            
            if (response.data?.response) {
              // Clean redacted reasoning from response
              let cleanResponse = response.data.response
              if (cleanResponse) {
                // Remove <think>...</think> blocks (model thinking parts)
                cleanResponse = cleanResponse
                  .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                  .replace(/<think>[\s\S]*?<\/think>/gi, '')
                  .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                  .replace(/<think>[\s\S]*?$/gi, '') // Handle unclosed tags
                  .trim()
              }
              
              const llmResult: SpotlightResult[] = [
                {
                  type: 'answer',
                  title: 'Answer',
                  description: cleanResponse,
                  metadata: { source: 'llm', intent }
                }
              ]
              setResults(llmResult)
              cacheResults(normalizedQuery, llmResult)
              llmResponseHandled = true
              setIsExpanded(true) // Expand when we have results
            } else if (response.error) {
              setLlmReady(false)
              setLlmMessage(response.error || 'LLM offline. Showing action history instead.')
            }
          } catch (error: any) {
            setIsThinking(false)
            if (signal.aborted || error.name === 'AbortError') return
            console.warn('LLM query failed, falling back to actions.', error)
            setLlmReady(false)
            setLlmMessage('LLM not reachable. Using action history instead.')
          }
        }

        // If LLM didn't handle it, use search results
        if (!llmResponseHandled && !signal.aborted) {
          const finalResults =
            searchResults.length > 0
              ? searchResults
              : [createAnswerResult(
                llmMessage ? 'LLM offline' : 'No matches',
                llmMessage || 'Could not find anything for that query.'
              )]
          setResults(finalResults)
          cacheResults(normalizedQuery, finalResults)
          if (finalResults.length > 0 || query.trim().length > 0) {
            setIsExpanded(true) // Expand when we have results or query
          }
        }
      } catch (error: any) {
        if (signal.aborted || error.name === 'AbortError') return
        console.error('Search error:', error)
        try {
          const searchResults = await searchActions(trimmed)
          if (signal.aborted) return
          
          const fallback =
            searchResults.length > 0
              ? searchResults
              : [createAnswerResult(
                'Error',
                'Could not search. Make sure backend is running.'
              )]
          setResults(fallback)
          cacheResults(normalizedQuery, fallback)
        } catch {
          if (signal.aborted) return
          const fallback = [
            createAnswerResult('Error', 'Could not search. Make sure backend is running.')
          ]
          setResults(fallback)
          cacheResults(normalizedQuery, fallback)
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
          setIsReloading(false)
          setIsThinking(false)
        }
      }
    }, 1200) // Wait 1.2 seconds after user stops typing

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [
    query,
    isOpen,
    reloadToken,
    searchActions,
    llmReady,
    llmMessage,
    cacheResults,
    createAnswerResult,
    detectIntent
  ])

  useEffect(() => {
    if (results.length === 0) {
      setDetailResult(null)
      return
    }
    setDetailResult(results[Math.min(selectedIndex, results.length - 1)])
  }, [results, selectedIndex])

  const handleSelect = useCallback((result: SpotlightResult) => {
    setDetailResult(result)
  }, [])

  const handleRunAction = useCallback(
    (result?: SpotlightResult) => {
      const target = result || detailResult
      if (target?.action) {
        target.action()
        closeSpotlight()
      }
    },
    [detailResult, closeSpotlight]
  )

  const handleCopyDetail = useCallback(async () => {
    if (!detailResult) return
    try {
      await navigator.clipboard.writeText(
        detailResult.description ||
        detailResult.metadata?.context?.full_command ||
        detailResult.metadata?.context?.url ||
        JSON.stringify(detailResult.metadata || {}, null, 2)
      )
    } catch (error) {
      console.error('Failed to copy spotlight detail', error)
    }
  }, [detailResult])

  const handleReload = useCallback(() => {
    if (!query.trim()) return
    setIsReloading(true)
    setReloadToken(prev => prev + 1)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        if ((e.metaKey || e.ctrlKey) && results[selectedIndex]?.action) {
          handleRunAction(results[selectedIndex])
        } else {
          handleSelect(results[selectedIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, handleSelect, handleRunAction])

  useEffect(() => {
    const node = listRefs.current[selectedIndex]
    if (node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, results])

  useEffect(() => {
    listRefs.current = Array(results.length).fill(null)
  }, [results.length])

  if (!isOpen) return null

  // Determine if we should show expanded view
  const shouldExpand = isExpanded || results.length > 0 || query.trim().length > 2

  return (
    <div 
      className="fixed inset-0 bg-black/20 z-50 flex items-start justify-center pt-[15vh] spotlight-overlay"
      onClick={closeSpotlight}
      style={{ overflow: 'hidden' }}
    >
      <div 
        className={`mx-4 liquid-glass flex flex-col ${
          shouldExpand 
            ? 'spotlight-expanded w-full max-w-5xl' 
            : 'spotlight-collapsed'
        }`}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          // Prevent background scroll when scrolling inside Spotlight
          e.stopPropagation()
        }}
        style={{ maxHeight: '85vh', overflow: 'hidden' }}
      >
        {/* Search Input - Always Visible */}
        <div className={`flex items-center gap-3 ${shouldExpand ? 'p-4 border-b border-white/20' : 'p-4'}`}>
          <div className="relative">
            {loading && isThinking ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#d4a574] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <MagnifyingGlass 
                className="w-5 h-5 text-gray-400" 
                weight="bold" 
              />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
              if (e.target.value.trim().length > 2) {
                setIsExpanded(true)
              } else if (e.target.value.trim().length === 0) {
                setIsExpanded(false)
                setResults([])
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 outline-none text-lg placeholder-gray-300 bg-transparent text-white"
          />
          {shouldExpand && currentModel && (
            <div className="flex items-center gap-1.5 text-xs text-gray-200 bg-white/20 px-2 py-1 rounded-lg">
              <Robot className="w-3.5 h-3.5" weight="fill" />
              <span className="font-medium">Trained {currentModel.date || 'recently'}</span>
            </div>
          )}
          {shouldExpand && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <kbd className="px-2 py-1 bg-white/20 rounded">Esc</kbd>
                <span>to close</span>
              </div>
              <button
                onClick={closeSpotlight}
                className="p-2 text-gray-300 hover:text-white transition"
                aria-label="Close search"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </>
          )}
        </div>

        {/* Results + Detail - Only show when expanded */}
        {shouldExpand && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            <div className="md:w-1/2 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto spotlight-scroll">
              {llmMessage && (
                <div className="flex items-center gap-2 p-3 text-xs text-amber-300 bg-amber-500/20 border-b border-amber-500/30">
                  <Warning className="w-4 h-4" weight="fill" />
                  <span>{llmMessage}</span>
                </div>
              )}
              {loading ? (
                <div className="p-8 text-center text-gray-300">
                  {isThinking ? (
                    <div className="space-y-4">
                      <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                        <div className="w-10 h-10 border-3 border-[#d4a574] border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <CaretRight className="w-4 h-4 text-gray-300 animate-pulse" />
                        <span className="font-medium text-white">Analyzing your data...</span>
                        <CaretRight className="w-4 h-4 text-gray-300 animate-pulse" />
                      </div>
                      <p className="text-xs text-gray-400">Searching history and generating insights</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-8 h-8 mx-auto flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#d4a574] border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-gray-300">Searching...</p>
                    </div>
                  )}
                </div>
              ) : results.length === 0 && query ? (
                <div className="p-8 text-center text-gray-300">
                  <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                    <MagnifyingGlass className="w-12 h-12 text-gray-500" weight="duotone" />
                  </div>
                  <p className="text-white font-medium">No results found</p>
                  <p className="text-sm mt-2 text-gray-400">Try asking a question about your behavior</p>
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      ref={el => { listRefs.current[index] = el }}
                      onClick={() => {
                        setSelectedIndex(index)
                        handleSelect(result)
                      }}
                      onDoubleClick={() => handleRunAction(result)}
                      className={`px-4 py-3 cursor-pointer transition-all ${
                        index === selectedIndex
                          ? 'bg-white/20 border-l-4 border-[#d4a574] backdrop-blur-sm'
                          : 'hover:bg-white/10 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {result.type === 'command' && <Terminal className="w-5 h-5 text-[#d4a574] mt-0.5" weight={index === selectedIndex ? 'fill' : 'regular'} />}
                        {result.type === 'action' && <Code className="w-5 h-5 text-purple-400 mt-0.5" weight={index === selectedIndex ? 'fill' : 'regular'} />}
                        {result.type === 'answer' && (
                          <div className="w-5 h-5 mt-0.5 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-[#d4a574] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white">{result.title}</div>
                          <div className="text-sm text-gray-300 mt-1 line-clamp-2">{result.description}</div>
                          {result.metadata?.timestamp && (
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(result.metadata.timestamp * 1000).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-300">
                  <div className="space-y-2">
                    <p className="font-medium text-white">Ask questions about your behavior</p>
                    <div className="text-sm space-y-1 text-left max-w-md mx-auto text-gray-400">
                      <p>• "What command did I use to run Cursor?"</p>
                      <p>• "How do I get to that place?"</p>
                      <p>• "What was the last git command I ran?"</p>
                      <p>• "Show me recent terminal commands"</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div 
              className="flex-1 hidden md:flex flex-col bg-white/5 backdrop-blur-sm overflow-hidden"
              onWheel={(e) => e.stopPropagation()}
            >
              {detailResult ? (
                <div className="p-6 flex flex-col h-full gap-4 overflow-hidden">
                  <div className="flex items-start justify-between gap-4 shrink-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wide text-gray-400">{detailResult.type}</p>
                      <h3 className="text-xl font-semibold text-white mt-1">{detailResult.title}</h3>
                      {detailResult.type === 'answer' ? (
                        <div className="mt-2 max-w-none overflow-y-auto max-h-[40vh] pr-2 spotlight-scroll">
                          <ReactMarkdown
                            className="prose prose-sm prose-invert text-gray-200 max-w-none"
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {detailResult.description
                              .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                              .replace(/<think>[\s\S]*?<\/think>/gi, '')
                              .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                              .replace(/<think>[\s\S]*?$/gi, '')
                              .trim()}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">
                          {detailResult.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyDetail}
                        className="px-3 py-1.5 text-xs border border-white/20 rounded-lg hover:bg-white/20 text-gray-200 hover:text-white transition"
                      >
                        Copy
                      </button>
                      <button
                        onClick={handleReload}
                        className="px-3 py-1.5 text-xs border border-white/20 rounded-lg hover:bg-white/20 text-gray-200 hover:text-white flex items-center gap-1 transition"
                        disabled={isReloading || !query.trim()}
                      >
                        <ArrowClockwise className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`} />
                        Reload
                      </button>
                      {detailResult.action && (
                        <button
                          onClick={() => handleRunAction(detailResult)}
                          className="px-3 py-1.5 text-xs bg-blue-500/80 text-white rounded-lg shadow-sm hover:bg-blue-500 transition"
                        >
                          Run ↵
                        </button>
                      )}
                    </div>
                  </div>

                  <div 
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-4 text-sm text-gray-200 flex-1 overflow-auto shadow-inner spotlight-scroll"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {detailResult.metadata ? (
                      <div className="space-y-2">
                        {detailResult.metadata.source && (
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-300">
                            <Globe className="w-4 h-4" />
                            <span>{detailResult.metadata.source}</span>
                          </div>
                        )}
                        {detailResult.metadata.timestamp && (
                          <div className="text-xs text-gray-300">
                            {new Date(detailResult.metadata.timestamp * 1000).toLocaleString()}
                          </div>
                        )}
                        {detailResult.metadata.context && (
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                            {JSON.stringify(detailResult.metadata.context, null, 2)}
                          </pre>
                        )}
                        {!detailResult.metadata.context && detailResult.metadata && (
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                            {JSON.stringify(detailResult.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-300 text-sm">
                        Select a result to see details, metadata, and context.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-300">
                  Select a result to view details
                </div>
              )}
            </div>

            {/* Mobile detail view */}
            <div className="md:hidden border-t border-white/10 max-h-56 overflow-y-auto spotlight-scroll">
              {detailResult ? (
                <div className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-300">{detailResult.type}</p>
                  <div className="font-semibold text-white">{detailResult.title}</div>
                  {detailResult.type === 'answer' ? (
                    <ReactMarkdown
                      className="prose prose-sm prose-invert text-gray-200 max-w-none"
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {detailResult.description
                        .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                        .replace(/<think>[\s\S]*?<\/think>/gi, '')
                        .replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '')
                        .replace(/<think>[\s\S]*?$/gi, '')
                        .trim()}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{detailResult.description}</p>
                  )}
                  {detailResult.metadata?.context && (
                    <pre className="text-xs text-gray-300 bg-white/10 rounded-lg p-3 whitespace-pre-wrap font-mono">
                      {JSON.stringify(detailResult.metadata.context, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="p-4 text-xs text-gray-300">Select a result to view details</div>
              )}
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts - Only show when expanded */}
        {shouldExpand && (
          <div className="px-6 py-3 border-t border-white/10 bg-white/5 flex items-center justify-center gap-6 text-xs text-gray-300">
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/20 rounded">⌘K</kbd>
              <span>to open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/20 rounded">↑↓</kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/20 rounded">⌘I</kbd>
              <span>to inspect</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/20 rounded">⌘⏎</kbd>
              <span>to run</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
