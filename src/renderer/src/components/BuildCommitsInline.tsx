import { useState, useEffect } from 'react'
import { GitCommit, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  fullname: string
  buildNumber: number
}

interface Commit {
  commitId: string
  msg: string
  author: string
}

export default function BuildCommitsInline({ fullname, buildNumber }: Props) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    window.api.jenkins.getBuild(fullname, buildNumber).then((build) => {
      if (cancelled) return

      const items: Commit[] = []
      for (const cs of build.changeSets ?? []) {
        for (const c of cs.items) {
          items.push({
            commitId: c.commitId,
            msg: c.msg.split('\n')[0],
            author: c.author.fullName
          })
        }
      }
      setCommits(items)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [fullname, buildNumber])

  if (loading || commits.length === 0) return null

  return (
    <div className="ml-10 mr-4 mb-1">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition py-0.5"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <GitCommit size={10} />
        <span className="font-medium">{commits.length} commit{commits.length !== 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {commits.slice(0, 5).map((c, i) => (
            <div
              key={`${c.commitId}-${i}`}
              className="flex items-start gap-2 pl-4 py-0.5 text-[11px]"
            >
              <span className="text-blue-400/70 font-mono shrink-0">{c.commitId.slice(0, 7)}</span>
              <span className="text-slate-300 truncate flex-1">{c.msg}</span>
              <span className="text-slate-600 shrink-0">{c.author}</span>
            </div>
          ))}
          {commits.length > 5 && (
            <p className="pl-4 text-[11px] text-slate-500">
              ...and {commits.length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}
