import { useState, useMemo } from 'react'
import { Search, Play, RefreshCw, ChevronRight, Folder } from 'lucide-react'
import { useJenkinsItems } from '../hooks/useJenkins'
import { colorToStatus, timeAgo, groupByFolder, parseFullname } from '../lib/utils'

interface Props {
  onOpenJob: (fullname: string) => void
}

export default function Dashboard({ onOpenJob }: Props) {
  const { data: items, loading, error, refresh } = useJenkinsItems()
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!items) return []
    if (!search) return items
    const lower = search.toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.fullname.toLowerCase().includes(lower)
    )
  }, [items, search])

  const grouped = useMemo(() => groupByFolder(filtered), [filtered])
  const folderNames = useMemo(
    () => Object.keys(grouped).sort(),
    [grouped]
  )

  // Auto-expand all folders when searching
  useMemo(() => {
    if (search) {
      setExpandedFolders(new Set(folderNames))
    }
  }, [search, folderNames])

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  const handleTriggerBuild = async (e: React.MouseEvent, fullname: string) => {
    e.stopPropagation()
    setTriggeringJob(fullname)
    try {
      await window.api.jenkins.buildItem(fullname)
      setTimeout(refresh, 2000)
    } catch (err) {
      console.error('Failed to trigger build:', err)
    } finally {
      setTriggeringJob(null)
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">Failed to connect to Jenkins</p>
          <p className="text-slate-500 text-xs mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded hover:bg-slate-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <div className="titlebar-no-drag relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="titlebar-no-drag p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <span className="titlebar-no-drag text-xs text-slate-500">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Jobs list */}
      <div className="flex-1 overflow-auto">
        {loading && !items ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {folderNames.map((folder) => {
              const jobs = grouped[folder]
              const isExpanded = expandedFolders.has(folder)
              const failedCount = jobs.filter(
                (j) => j.color === 'red' || j.color === 'red_anime'
              ).length
              const runningCount = jobs.filter(
                (j) => j.color?.endsWith('_anime')
              ).length

              return (
                <div key={folder}>
                  {/* Folder header */}
                  <button
                    onClick={() => toggleFolder(folder)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-slate-900/50 hover:bg-slate-900 transition text-sm"
                  >
                    <ChevronRight
                      size={14}
                      className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    <Folder size={14} className="text-slate-500" />
                    <span className="font-medium text-slate-300">{folder}</span>
                    <span className="text-xs text-slate-500">({jobs.length})</span>
                    {failedCount > 0 && (
                      <span className="ml-auto text-xs text-red-400 bg-red-400/10 px-1.5 rounded">
                        {failedCount} failed
                      </span>
                    )}
                    {runningCount > 0 && (
                      <span className={`${failedCount > 0 ? '' : 'ml-auto'} text-xs text-blue-400 bg-blue-400/10 px-1.5 rounded`}>
                        {runningCount} running
                      </span>
                    )}
                  </button>

                  {/* Jobs in folder */}
                  {isExpanded && (
                    <div>
                      {jobs.map((item) => {
                        const status = colorToStatus(item.color)
                        const { name } = parseFullname(item.fullname)
                        const subPath = item.fullname
                          .split('/')
                          .slice(1, -1)
                          .join('/')

                        return (
                          <button
                            key={item.fullname}
                            onClick={() => onOpenJob(item.fullname)}
                            className="w-full flex items-center gap-3 px-4 py-2 pl-10 hover:bg-slate-900/50 transition group"
                          >
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotClass}`}
                            />
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-2">
                                {subPath && (
                                  <span className="text-xs text-slate-500">{subPath}/</span>
                                )}
                                <span className="text-sm text-slate-200 truncate">
                                  {name}
                                </span>
                              </div>
                            </div>
                            <span className={`text-xs ${status.class}`}>
                              {status.label}
                            </span>
                            {item.lastBuild && (
                              <span className="text-xs text-slate-500">
                                #{item.lastBuild.number}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleTriggerBuild(e, item.fullname)}
                              disabled={triggeringJob === item.fullname}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition"
                              title="Trigger build"
                            >
                              <Play
                                size={12}
                                className={
                                  triggeringJob === item.fullname ? 'animate-pulse' : ''
                                }
                              />
                            </button>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
