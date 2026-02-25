import { useState, useEffect } from 'react'
import { XCircle, AlertTriangle, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface Props {
  fullname: string
  buildNumber: number
  onOpenTestResults: (fullname: string, buildNumber: number) => void
}

interface FailedTest {
  name: string
  className: string
  status: string
  errorDetails?: string
  errorStackTrace?: string
}

/** Format all failed tests into a single string optimized for pasting into AI */
function formatForAI(fullname: string, buildNumber: number, tests: FailedTest[]): string {
  const lines: string[] = [
    `Failed tests from ${fullname} #${buildNumber}:`,
    ''
  ]
  for (const test of tests) {
    lines.push(`FAILED: ${test.className ? test.className + '.' : ''}${test.name}`)
    if (test.errorDetails) {
      // Keep first meaningful lines of the error, trim excessive output
      const errorLines = test.errorDetails.split('\n').filter(l => l.trim()).slice(0, 5)
      lines.push(errorLines.map(l => `  ${l}`).join('\n'))
    }
    if (test.errorStackTrace) {
      const stackLines = test.errorStackTrace.split('\n').filter(l => l.trim()).slice(0, 8)
      lines.push(stackLines.map(l => `  ${l}`).join('\n'))
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

/** Format a single test for copy */
function formatSingleTestForAI(fullname: string, buildNumber: number, test: FailedTest): string {
  const lines: string[] = [
    `Failed test from ${fullname} #${buildNumber}:`,
    '',
    `FAILED: ${test.className ? test.className + '.' : ''}${test.name}`
  ]
  if (test.errorDetails) {
    lines.push(test.errorDetails.split('\n').filter(l => l.trim()).slice(0, 10).join('\n'))
  }
  if (test.errorStackTrace) {
    lines.push(test.errorStackTrace.split('\n').filter(l => l.trim()).slice(0, 15).join('\n'))
  }
  return lines.join('\n').trim()
}

export default function FailedTestsInline({ fullname, buildNumber, onOpenTestResults }: Props) {
  const [failedTests, setFailedTests] = useState<FailedTest[]>([])
  const [failCount, setFailCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    window.api.jenkins.getTestReport(fullname, buildNumber).then((report) => {
      if (cancelled || !report) {
        if (!cancelled) setLoading(false)
        return
      }

      setFailCount(report.failCount)

      const failed: FailedTest[] = []
      for (const suite of report.suites) {
        for (const tc of suite.cases) {
          if (tc.status === 'FAILED' || tc.status === 'REGRESSION') {
            failed.push({
              name: tc.name,
              className: tc.className,
              status: tc.status,
              errorDetails: tc.errorDetails,
              errorStackTrace: tc.errorStackTrace
            })
          }
        }
      }
      setFailedTests(failed)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [fullname, buildNumber])

  const copyAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = formatForAI(fullname, buildNumber, failedTests)
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const copySingle = (e: React.MouseEvent, test: FailedTest, index: number) => {
    e.stopPropagation()
    const text = formatSingleTestForAI(fullname, buildNumber, test)
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (loading || failedTests.length === 0) return null

  return (
    <div className="ml-10 mr-4 mb-1">
      {/* Header row */}
      <div className="flex items-center gap-1.5 py-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <XCircle size={10} />
          <span className="font-medium">{failCount} test{failCount !== 1 ? 's' : ''} failed</span>
        </button>
        <button
          onClick={copyAll}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition ml-2 px-1.5 py-0.5 rounded hover:bg-slate-800"
          title="Copy all failed tests for AI"
        >
          {copiedAll ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
          {copiedAll ? 'Copied!' : 'Copy all'}
        </button>
      </div>

      {/* Test list */}
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {failedTests.slice(0, 10).map((test, i) => (
            <div
              key={`${test.className}-${test.name}-${i}`}
              className="flex items-start gap-2 pl-4 py-0.5 text-[11px] group/test"
            >
              <XCircle size={9} className="text-red-400/70 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300">{test.name}</span>
                  {test.className && (
                    <span className="text-slate-600">({test.className.split('.').pop()})</span>
                  )}
                  <button
                    onClick={(e) => copySingle(e, test, i)}
                    className="opacity-0 group-hover/test:opacity-100 p-0.5 text-slate-600 hover:text-slate-300 transition rounded hover:bg-slate-800 shrink-0"
                    title="Copy this test error for AI"
                  >
                    {copiedIndex === i
                      ? <Check size={9} className="text-emerald-400" />
                      : <Copy size={9} />
                    }
                  </button>
                </div>
                {test.errorDetails && (
                  <p className="text-red-400/60 truncate mt-0.5 max-w-full">
                    {test.errorDetails.split('\n')[0].slice(0, 150)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {failedTests.length > 10 && (
            <p className="pl-4 text-[11px] text-slate-500">
              ...and {failedTests.length - 10} more
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenTestResults(fullname, buildNumber)
            }}
            className="pl-4 text-[11px] text-blue-400 hover:text-blue-300 transition flex items-center gap-1 py-0.5"
          >
            <AlertTriangle size={9} />
            View full test report
          </button>
        </div>
      )}
    </div>
  )
}
