import { useState, useEffect } from 'react'
import { XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

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
}

export default function FailedTestsInline({ fullname, buildNumber, onOpenTestResults }: Props) {
  const [failedTests, setFailedTests] = useState<FailedTest[]>([])
  const [failCount, setFailCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

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
              errorDetails: tc.errorDetails
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

  if (loading || failedTests.length === 0) return null

  return (
    <div className="ml-10 mr-4 mb-1">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition py-0.5"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <XCircle size={10} />
        <span className="font-medium">{failCount} test{failCount !== 1 ? 's' : ''} failed</span>
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {failedTests.slice(0, 10).map((test, i) => (
            <div
              key={`${test.className}-${test.name}-${i}`}
              className="flex items-start gap-2 pl-4 py-0.5 text-[11px] group/test"
            >
              <XCircle size={9} className="text-red-400/70 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-300">{test.name}</span>
                {test.className && (
                  <span className="text-slate-600 ml-1">({test.className.split('.').pop()})</span>
                )}
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
