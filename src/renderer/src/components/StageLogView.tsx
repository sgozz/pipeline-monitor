import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, RefreshCw, Copy, Check, ArrowDown } from 'lucide-react'
import { ansiToHtml } from '../lib/utils'

interface Props {
  fullname: string
  buildNumber: number
  stageId: string
  stageName: string
  onBack: () => void
}

export default function StageLogView({ fullname, buildNumber, stageId, stageName, onBack }: Props) {
  const [logText, setLogText] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchLog = async () => {
    try {
      const data = await window.api.jenkins.getStageLog(fullname, buildNumber, stageId)
      setLogText(data.text || '')
    } catch (err) {
      setLogText(`Error fetching stage log: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLog()
  }, [fullname, buildNumber, stageId])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logText, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(logText)
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
            Stage: {stageName}
          </h1>
          <span className="text-xs text-slate-500">Build #{buildNumber}</span>
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
            onClick={fetchLog}
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

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-slate-950 p-4 console-output"
      >
        {loading && !logText ? (
          <div className="text-slate-500">Loading stage log...</div>
        ) : (
          <pre
            className="whitespace-pre-wrap break-words text-slate-300"
            dangerouslySetInnerHTML={{ __html: ansiToHtml(logText) }}
          />
        )}
      </div>
    </div>
  )
}
