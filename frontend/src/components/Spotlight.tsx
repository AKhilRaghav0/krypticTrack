import { useState, useEffect, useRef, useCallback } from 'react'
import { MagnifyingGlass, Command, X, Sparkle, Terminal, Globe, Code } from '@phosphor-icons/react'
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Open/close with Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const searchActions = useCallback(async (q: string): Promise<SpotlightResult[]> => {
    try {
      const response = await fetch(`http://localhost:5000/api/actions/search?q=${encodeURIComponent(q)}`)
      const data = await response.json()
      
      return data.results?.map((action: any) => ({
        type: 'action' as const,
        title: action.action_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Action',
        description: action.context?.full_command || action.context?.url || action.context?.file_path || 'No details',
        metadata: action
      })) || []
    } catch (error) {
      return []
    }
  }, [])

  // Search when query changes
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true)
      try {
        // Use LLM to answer questions about behavior
        const response = await api.sendChatMessage(query)
        
        if (response.data?.response) {
          setResults([
            {
              type: 'answer',
              title: 'Answer',
              description: response.data.response,
              metadata: { source: 'llm' }
            }
          ])
        } else if (response.error) {
          // Fallback: search actions if LLM fails
          const searchResults = await searchActions(query)
          setResults(searchResults.length > 0 ? searchResults : [{
            type: 'answer',
            title: 'Error',
            description: response.error || 'Could not search. Make sure backend is running.',
          }])
        } else {
          // Fallback: search actions
          const searchResults = await searchActions(query)
          setResults(searchResults)
        }
      } catch (error) {
        console.error('Search error:', error)
        // Fallback to action search
        try {
          const searchResults = await searchActions(query)
          setResults(searchResults.length > 0 ? searchResults : [{
            type: 'answer',
            title: 'Error',
            description: 'Could not search. Make sure backend is running.',
          }])
        } catch {
          setResults([{
            type: 'answer',
            title: 'Error',
            description: 'Could not search. Make sure backend is running.',
          }])
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query, isOpen, searchActions])

  const handleSelect = useCallback((result: SpotlightResult) => {
    if (result.action) {
      result.action()
    }
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [])

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
        handleSelect(results[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, handleSelect])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <MagnifyingGlass className="w-5 h-5 text-gray-400" weight="bold" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Ask anything... 'What command did I use to run Cursor?' or 'How do I get to that place?'"
            className="flex-1 outline-none text-lg placeholder-gray-400"
          />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <kbd className="px-2 py-1 bg-gray-100 rounded">Esc</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <Sparkle className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p>Thinking...</p>
            </div>
          ) : results.length === 0 && query ? (
            <div className="p-8 text-center text-gray-500">
              <p>No results found</p>
              <p className="text-sm mt-2">Try asking a question about your behavior</p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  onClick={() => handleSelect(result)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-primary/10 border-l-4 border-primary'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.type === 'command' && <Terminal className="w-5 h-5 text-primary mt-0.5" />}
                    {result.type === 'action' && <Code className="w-5 h-5 text-secondary mt-0.5" />}
                    {result.type === 'answer' && <Sparkle className="w-5 h-5 text-tertiary mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{result.title}</div>
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">{result.description}</div>
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
            <div className="p-8 text-center text-gray-500">
              <div className="space-y-2">
                <p className="font-medium">Ask questions about your behavior</p>
                <div className="text-sm space-y-1 text-left max-w-md mx-auto">
                  <p>• "What command did I use to run Cursor?"</p>
                  <p>• "How do I get to that place?"</p>
                  <p>• "What was the last git command I ran?"</p>
                  <p>• "Show me recent terminal commands"</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <kbd className="px-1.5 py-0.5 bg-white rounded">K</kbd>
              <span>to open</span>
            </div>
            <div className="flex items-center gap-1">
              <span>↑↓</span>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <span>↵</span>
              <span>to select</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

