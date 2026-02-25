import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, ArrowDown, ArrowUp, RefreshCw, Copy, Check, Search, X } from 'lucide-react'
import { ansiToHtml, parseFullname } from '../lib/utils'

interface Props {
  fullname: string
  buildNumber: number
  onBack: () => void
}

export default function ConsoleOutput({ fullname, buildNumber, onBack }: Props) {
  const [output, setOutput] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { name } = parseFullname(fullname)

  const fetchOutput = async () => {
    try {
      const text = await window.api.jenkins.getConsoleOutput(fullname, buildNumber)
      setOutput(text)
    } catch (err) {
      setOutput(`Error fetching console output: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOutput()
    // Poll for updates if build might still be running
    const timer = setInterval(fetchOutput, 5000)
    return () => clearInterval(timer)
  }, [fullname, buildNumber])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current && !searchOpen) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [output, autoScroll, searchOpen])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    // Disable auto-scroll if user scrolled up more than 100px from bottom
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  // Search highlighting
  const matchCount = useMemo(() => {
    if (!searchQuery || !output) return 0
    try {
      const regex = new RegExp(escapeRegex(searchQuery), 'gi')
      return (output.match(regex) || []).length
    } catch {
      return 0
    }
  }, [output, searchQuery])

  const highlightedHtml = useMemo(() => {
    const baseHtml = ansiToHtml(output)
    if (!searchQuery) return baseHtml
    try {
      const escaped = escapeRegex(searchQuery)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const regex = new RegExp(`(${escaped})`, 'gi')
      let idx = 0
      return baseHtml.replace(regex, (match) => {
        const isCurrent = idx === matchIndex
        idx++
        return `<mark class="${isCurrent ? 'console-search-current' : 'console-search-match'}">${match}</mark>`
      })
    } catch {
      return baseHtml
    }
  }, [output, searchQuery, matchIndex])

  // Scroll to current match
  useEffect(() => {
    if (!searchQuery || !containerRef.current) return
    const marks = containerRef.current.querySelectorAll('.console-search-current')
    if (marks.length > 0) {
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [matchIndex, highlightedHtml])

  const nextMatch = () => setMatchIndex((prev) => (prev + 1) % Math.max(1, matchCount))
  const prevMatch = () => setMatchIndex((prev) => (prev - 1 + matchCount) % Math.max(1, matchCount))

  // Keyboard shortcut: Cmd+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={onBack}
          className="titlebar-no-drag p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="titlebar-no-drag flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-200 truncate">
            {name} #{buildNumber}
          </h1>
          <span className="text-xs text-slate-500">Console Output</span>
        </div>
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={() => {
              setSearchOpen(!searchOpen)
              if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
              else setSearchQuery('')
            }}
            className={`p-1.5 rounded transition ${searchOpen ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title="Search (Cmd+F)"
          >
            <Search size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Copy output"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={fetchOutput}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {!autoScroll && !searchOpen && (
            <button
              onClick={scrollToBottom}
              className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition"
              title="Scroll to bottom"
            >
              <ArrowDown size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
          <Search size={12} className="text-slate-500 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setMatchIndex(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.shiftKey ? prevMatch() : nextMatch()
            }}
            placeholder="Search in console..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-xs text-slate-500 shrink-0">
              {matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : 'No matches'}
            </span>
          )}
          <button onClick={prevMatch} disabled={matchCount === 0} className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition">
            <ArrowUp size={12} />
          </button>
          <button onClick={nextMatch} disabled={matchCount === 0} className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition">
            <ArrowDown size={12} />
          </button>
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery('') }}
            className="p-1 text-slate-400 hover:text-slate-200 transition"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Console */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-slate-950 p-4 console-output"
      >
        {loading && !output ? (
          <div className="text-slate-500">Loading console output...</div>
        ) : (
          <pre
            className="whitespace-pre-wrap break-words text-slate-300"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        )}
      </div>
    </div>
  )
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
