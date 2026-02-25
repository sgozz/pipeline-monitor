import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ArrowDown, RefreshCw, Copy, Check } from 'lucide-react'
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
  const containerRef = useRef<HTMLDivElement>(null)
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
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [output, autoScroll])

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
          {!autoScroll && (
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
            dangerouslySetInnerHTML={{ __html: ansiToHtml(output) }}
          />
        )}
      </div>
    </div>
  )
}
