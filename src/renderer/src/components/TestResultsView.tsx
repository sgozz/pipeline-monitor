import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
import { formatDuration } from '../lib/utils'

interface Props {
  fullname: string
  buildNumber: number
  onBack: () => void
}

export default function TestResultsView({ fullname, buildNumber, onBack }: Props) {
  const [report, setReport] = useState<JenkinsTestReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'failed' | 'passed' | 'skipped'>('all')

  useEffect(() => {
    setLoading(true)
    window.api.jenkins.getTestReport(fullname, buildNumber).then((r) => {
      setReport(r)
      // Auto-expand suites with failures
      if (r) {
        const failing = new Set<string>()
        for (const suite of r.suites) {
          if (suite.cases.some((c) => c.status === 'FAILED' || c.status === 'REGRESSION')) {
            failing.add(suite.name)
          }
        }
        setExpandedSuites(failing)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [fullname, buildNumber])

  const toggleSuite = (name: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const statusIcon = (status: string) => {
    if (status === 'PASSED' || status === 'FIXED') return <CheckCircle size={12} className="text-emerald-400" />
    if (status === 'FAILED' || status === 'REGRESSION') return <XCircle size={12} className="text-red-400" />
    return <MinusCircle size={12} className="text-slate-500" />
  }

  const filteredSuites = report?.suites.map((suite) => ({
    ...suite,
    cases: suite.cases.filter((c) => {
      if (filter === 'all') return true
      if (filter === 'failed') return c.status === 'FAILED' || c.status === 'REGRESSION'
      if (filter === 'passed') return c.status === 'PASSED' || c.status === 'FIXED'
      if (filter === 'skipped') return c.status === 'SKIPPED'
      return true
    })
  })).filter((s) => s.cases.length > 0) ?? []

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
          <h1 className="text-sm font-semibold text-slate-200">Test Results — #{buildNumber}</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw size={20} className="animate-spin text-slate-500" />
        </div>
      ) : !report ? (
        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
          No test results available
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Summary bar */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">{report.passCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle size={14} className="text-red-400" />
              <span className="text-sm text-red-400 font-medium">{report.failCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MinusCircle size={14} className="text-slate-500" />
              <span className="text-sm text-slate-500 font-medium">{report.skipCount}</span>
            </div>
            <span className="text-xs text-slate-600 ml-auto">
              {formatDuration(report.duration * 1000)}
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-slate-800/50">
            {(['all', 'failed', 'passed', 'skipped'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded transition ${
                  filter === f
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Suites */}
          <div className="divide-y divide-slate-800/50">
            {filteredSuites.map((suite) => {
              const isExpanded = expandedSuites.has(suite.name)
              const failCount = suite.cases.filter(
                (c) => c.status === 'FAILED' || c.status === 'REGRESSION'
              ).length
              return (
                <div key={suite.name}>
                  <button
                    onClick={() => toggleSuite(suite.name)}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-900/50 transition text-sm"
                  >
                    {isExpanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                    <span className="text-slate-300 truncate flex-1 text-left">{suite.name || 'Default Suite'}</span>
                    <span className="text-xs text-slate-600">{suite.cases.length} tests</span>
                    {failCount > 0 && (
                      <span className="text-xs text-red-400 bg-red-400/10 px-1.5 rounded">{failCount} failed</span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-950/50">
                      {suite.cases.map((tc, i) => (
                        <div
                          key={`${tc.className}-${tc.name}-${i}`}
                          className="flex items-start gap-2 pl-10 pr-4 py-1.5 text-xs"
                        >
                          {statusIcon(tc.status)}
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-300">{tc.name}</span>
                            {tc.className && (
                              <span className="text-slate-600 ml-1">({tc.className})</span>
                            )}
                            {tc.errorDetails && (
                              <pre className="mt-1 text-red-400/80 text-[11px] whitespace-pre-wrap break-words bg-red-400/5 rounded p-2 max-h-32 overflow-auto">
                                {tc.errorDetails}
                              </pre>
                            )}
                          </div>
                          <span className="text-slate-600 shrink-0">
                            {tc.duration > 0 ? formatDuration(tc.duration * 1000) : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
