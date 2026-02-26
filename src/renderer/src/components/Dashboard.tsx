import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  Play,
  RefreshCw,
  ChevronRight,
  Folder,
  GitBranch,
  Star,
  Pin,
  PinOff,
  Filter,
  Layers
} from 'lucide-react'
import { useJenkinsItems } from '../hooks/useJenkins'
import { colorToStatus, groupHierarchically, sortFolderGroups, sortJobsByStatus } from '../lib/utils'
import BuildParamsDialog from './BuildParamsDialog'
import FailedTestsInline from './FailedTestsInline'
import BuildCommitsInline from './BuildCommitsInline'

type StatusFilter = 'all' | 'failed' | 'running' | 'unstable' | 'success'

interface Props {
  onOpenJob: (fullname: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export default function Dashboard({ onOpenJob, searchInputRef }: Props) {
  const { data: items, loading, error, refresh } = useJenkinsItems()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [pinnedFolders, setPinnedFolders] = useState<string[]>([])
  const [buildParamsJob, setBuildParamsJob] = useState<string | null>(null)
  const [views, setViews] = useState<JenkinsView[]>([])
  const [groupByView, setGroupByView] = useState(false)
  const localSearchRef = useRef<HTMLInputElement>(null)
  const inputRef = searchInputRef ?? localSearchRef

  // Load favorites, pinned folders, and views on mount
  useEffect(() => {
    window.api.favorites.get().then((favs) => setFavorites(new Set(favs)))
    window.api.settings.getPinnedFolders().then(setPinnedFolders).catch(() => {})
    window.api.jenkins.getViews().then(setViews).catch(() => {})
  }, [])

  const toggleFavorite = useCallback(async (e: React.MouseEvent, fullname: string) => {
    e.stopPropagation()
    const updated = await window.api.favorites.toggle(fullname)
    setFavorites(new Set(updated))
  }, [])

  const togglePin = useCallback((e: React.MouseEvent, folder: string) => {
    e.stopPropagation()
    setPinnedFolders((prev) => {
      const next = prev.includes(folder)
        ? prev.filter((f) => f !== folder)
        : [...prev, folder]
      window.api.settings.setPinnedFolders(next).catch(() => {})
      return next
    })
  }, [])

  // Apply search + status filter
  const filtered = useMemo(() => {
    if (!items) return []
    let result = items

    // Search filter
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lower) ||
          item.fullname.toLowerCase().includes(lower)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((item) => {
        const base = item.color?.replace('_anime', '') || 'notbuilt'
        const isAnimated = item.color?.endsWith('_anime')
        switch (statusFilter) {
          case 'failed': return base === 'red'
          case 'running': return !!isAnimated
          case 'unstable': return base === 'yellow'
          case 'success': return base === 'blue' || base === 'green'
          default: return true
        }
      })
    }

    return result
  }, [items, search, statusFilter])

  const grouped = useMemo(() => groupHierarchically(filtered), [filtered])
  const sortedGroups = useMemo(
    () => sortFolderGroups(grouped, pinnedFolders),
    [grouped, pinnedFolders]
  )

  // Views grouping
  const viewGroups = useMemo(() => {
    if (!groupByView || views.length === 0 || !items) return null
    const result: { view: string; items: JenkinsItem[] }[] = []
    const assigned = new Set<string>()

    for (const view of views) {
      const viewJobNames = new Set((view.jobs || []).map((j) => j.fullName || j.name))
      const matching = filtered.filter((item) => {
        // Check if item or any parent folder matches a view job
        return viewJobNames.has(item.fullname) || viewJobNames.has(item.fullname.split('/')[0])
      })
      if (matching.length > 0) {
        result.push({ view: view.name, items: matching })
        matching.forEach((m) => assigned.add(m.fullname))
      }
    }

    const unassigned = filtered.filter((item) => !assigned.has(item.fullname))
    if (unassigned.length > 0) {
      result.push({ view: 'Other', items: unassigned })
    }

    return result
  }, [groupByView, views, filtered, items])

  const favoriteItems = useMemo(() => {
    if (!items || favorites.size === 0) return []
    return items.filter((item) => favorites.has(item.fullname))
  }, [items, favorites])

  // Auto-expand all folders and jobs when searching
  useMemo(() => {
    if (search || statusFilter !== 'all') {
      setExpandedFolders(new Set(sortedGroups.map((g) => g.folder)))
      const allJobKeys = new Set<string>()
      for (const fg of sortedGroups) {
        for (const jg of fg.jobs) {
          allJobKeys.add(`${fg.folder}/${jg.job}`)
        }
      }
      setExpandedJobs(allJobKeys)
    }
  }, [search, statusFilter, sortedGroups])

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  const toggleJob = (key: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleTriggerBuild = async (e: React.MouseEvent, fullname: string) => {
    e.stopPropagation()
    // Check if job has parameters
    try {
      const params = await window.api.jenkins.getBuildParameters(fullname)
      if (params.length > 0) {
        setBuildParamsJob(fullname)
        return
      }
    } catch { /* ignore */ }
    // No params — trigger immediately
    doTriggerBuild(fullname)
  }

  const doTriggerBuild = async (fullname: string, params?: Record<string, string>) => {
    setTriggeringJob(fullname)
    setBuildParamsJob(null)
    try {
      await window.api.jenkins.buildItem(fullname, params)
      setTimeout(refresh, 2000)
    } catch (err) {
      console.error('Failed to trigger build:', err)
    } finally {
      setTriggeringJob(null)
    }
  }

  // Status filter counts
  const filterCounts = useMemo(() => {
    if (!items) return { failed: 0, running: 0, unstable: 0, success: 0 }
    let failed = 0, running = 0, unstable = 0, success = 0
    for (const item of items) {
      const base = item.color?.replace('_anime', '') || 'notbuilt'
      if (item.color?.endsWith('_anime')) running++
      if (base === 'red') failed++
      else if (base === 'yellow') unstable++
      else if (base === 'blue' || base === 'green') success++
    }
    return { failed, running, unstable, success }
  }, [items])

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
            ref={inputRef}
            type="text"
            placeholder="Search jobs... (Cmd+K)"
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
        {views.length > 0 && (
          <button
            onClick={() => setGroupByView(!groupByView)}
            className={`titlebar-no-drag p-1.5 rounded transition ${groupByView ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title="Group by Jenkins Views"
          >
            <Layers size={14} />
          </button>
        )}
        <span className="titlebar-no-drag text-xs text-slate-500">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status filter bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/50">
        <Filter size={12} className="text-slate-600 mr-1" />
        {([
          { key: 'all' as const, label: 'All' },
          { key: 'failed' as const, label: 'Failed', count: filterCounts.failed, color: 'text-red-400' },
          { key: 'running' as const, label: 'Running', count: filterCounts.running, color: 'text-blue-400' },
          { key: 'unstable' as const, label: 'Unstable', count: filterCounts.unstable, color: 'text-amber-400' },
          { key: 'success' as const, label: 'Success', count: filterCounts.success, color: 'text-emerald-400' }
        ]).map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-2.5 py-1 text-xs rounded transition ${
              statusFilter === key
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`ml-1 ${statusFilter === key ? 'text-white/70' : color}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div className="flex-1 overflow-auto">
        {loading && !items ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : groupByView && viewGroups ? (
          /* View-based grouping */
          <div className="divide-y divide-slate-800/50">
            {viewGroups.map((vg) => (
              <ViewGroupSection
                key={vg.view}
                viewName={vg.view}
                items={vg.items}
                favorites={favorites}
                onOpenJob={onOpenJob}
                onToggleFavorite={toggleFavorite}
                onTriggerBuild={handleTriggerBuild}
                triggeringJob={triggeringJob}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {/* Favorites section */}
            {favoriteItems.length > 0 && !search && statusFilter === 'all' && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border-b border-slate-800/50">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="font-medium text-amber-300 text-sm">Favorites</span>
                  <span className="text-xs text-slate-500">({favoriteItems.length})</span>
                </div>
                <div>
                  {favoriteItems.map((item) => {
                    const base = item.color?.replace('_anime', '') || 'notbuilt'
                    const hasFailed = base === 'red' || base === 'yellow'
                    return (
                      <div key={`fav-${item.fullname}`}>
                        <BranchRow
                          item={item}
                          isFavorite={true}
                          showFullPath
                          onOpenJob={onOpenJob}
                          onToggleFavorite={toggleFavorite}
                          onTriggerBuild={handleTriggerBuild}
                          triggeringJob={triggeringJob}
                          indent={1}
                        />
                        {item.lastBuild && (
                          <BuildCommitsInline
                            fullname={item.fullname}
                            buildNumber={item.lastBuild.number}
                          />
                        )}
                        {hasFailed && item.lastBuild && (
                          <FailedTestsInline
                            fullname={item.fullname}
                            buildNumber={item.lastBuild.number}
                            onOpenTestResults={() => onOpenJob(item.fullname)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Folder > Job > Branch hierarchy */}
            {sortedGroups.map((folderGroup) => {
              const isExpanded = expandedFolders.has(folderGroup.folder)
              const isPinned = pinnedFolders.includes(folderGroup.folder)
              const failedCount = folderGroup.allItems.filter(
                (j) => j.color === 'red' || j.color === 'red_anime'
              ).length
              const runningCount = folderGroup.allItems.filter(
                (j) => j.color?.endsWith('_anime')
              ).length

              return (
                <div key={folderGroup.folder}>
                  {/* Folder header */}
                  <button
                    onClick={() => toggleFolder(folderGroup.folder)}
                    className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-900 transition text-sm ${
                      isPinned ? 'bg-slate-900/80' : 'bg-slate-900/50'
                    }`}
                  >
                    <ChevronRight
                      size={14}
                      className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    {isPinned ? (
                      <Pin size={14} className="text-amber-400" />
                    ) : (
                      <Folder size={14} className="text-slate-500" />
                    )}
                    <span className={`font-medium ${isPinned ? 'text-slate-200' : 'text-slate-300'}`}>
                      {folderGroup.folder}
                    </span>
                    <span className="text-xs text-slate-500">({folderGroup.allItems.length})</span>
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
                    <button
                      onClick={(e) => togglePin(e, folderGroup.folder)}
                      className={`${failedCount === 0 && runningCount === 0 ? 'ml-auto' : ''} p-0.5 rounded transition ${
                        isPinned
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                          : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                      }`}
                      title={isPinned ? 'Unpin folder' : 'Pin folder to top'}
                    >
                      {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                  </button>

                  {/* Jobs in folder */}
                  {isExpanded && (
                    <div>
                      {folderGroup.jobs.map((jobGroup) => {
                        const jobKey = `${folderGroup.folder}/${jobGroup.job}`
                        const isJobExpanded = expandedJobs.has(jobKey)
                        const hasBranches = jobGroup.branches.length > 1
                        const sortedBranches = sortJobsByStatus(jobGroup.branches)
                        const jobFailed = sortedBranches.filter(
                          (j) => j.color === 'red' || j.color === 'red_anime'
                        ).length
                        const jobRunning = sortedBranches.filter(
                          (j) => j.color?.endsWith('_anime')
                        ).length

                        // If single branch, render it directly without a sub-group
                        if (!hasBranches) {
                          return (
                            <BranchRow
                              key={sortedBranches[0].fullname}
                              item={sortedBranches[0]}
                              isFavorite={favorites.has(sortedBranches[0].fullname)}
                              onOpenJob={onOpenJob}
                              onToggleFavorite={toggleFavorite}
                              onTriggerBuild={handleTriggerBuild}
                              triggeringJob={triggeringJob}
                              indent={1}
                            />
                          )
                        }

                        return (
                          <div key={jobKey}>
                            {/* Job sub-header */}
                            <button
                              onClick={() => toggleJob(jobKey)}
                              className="w-full flex items-center gap-2 pl-8 pr-4 py-1.5 hover:bg-slate-900/30 transition text-sm"
                            >
                              <ChevronRight
                                size={12}
                                className={`text-slate-600 transition-transform ${isJobExpanded ? 'rotate-90' : ''}`}
                              />
                              <GitBranch size={12} className="text-slate-600" />
                              <span className="text-slate-400 text-xs font-medium">{jobGroup.job}</span>
                              <span className="text-xs text-slate-600">({sortedBranches.length})</span>
                              {jobFailed > 0 && (
                                <span className="ml-auto text-[10px] text-red-400 bg-red-400/10 px-1 rounded">
                                  {jobFailed}
                                </span>
                              )}
                              {jobRunning > 0 && (
                                <span className={`${jobFailed > 0 ? '' : 'ml-auto'} text-[10px] text-blue-400 bg-blue-400/10 px-1 rounded`}>
                                  {jobRunning}
                                </span>
                              )}
                            </button>

                            {/* Branches */}
                            {isJobExpanded && (
                              <div>
                                {sortedBranches.map((item) => (
                                  <BranchRow
                                    key={item.fullname}
                                    item={item}
                                    isFavorite={favorites.has(item.fullname)}
                                    onOpenJob={onOpenJob}
                                    onToggleFavorite={toggleFavorite}
                                    onTriggerBuild={handleTriggerBuild}
                                    triggeringJob={triggeringJob}
                                    indent={2}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
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

      {/* Build Parameters Dialog */}
      {buildParamsJob && (
        <BuildParamsDialog
          fullname={buildParamsJob}
          onBuild={(params) => doTriggerBuild(buildParamsJob!, params)}
          onCancel={() => setBuildParamsJob(null)}
        />
      )}
    </div>
  )
}

/** View-based grouping section */
function ViewGroupSection({
  viewName,
  items,
  favorites,
  onOpenJob,
  onToggleFavorite,
  onTriggerBuild,
  triggeringJob
}: {
  viewName: string
  items: JenkinsItem[]
  favorites: Set<string>
  onOpenJob: (fullname: string) => void
  onToggleFavorite: (e: React.MouseEvent, fullname: string) => void
  onTriggerBuild: (e: React.MouseEvent, fullname: string) => void
  triggeringJob: string | null
}) {
  const [expanded, setExpanded] = useState(true)
  const sorted = sortJobsByStatus(items)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-slate-900/50 hover:bg-slate-900 transition text-sm"
      >
        <ChevronRight
          size={14}
          className={`text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <Layers size={14} className="text-blue-400" />
        <span className="font-medium text-slate-300">{viewName}</span>
        <span className="text-xs text-slate-500">({items.length})</span>
      </button>
      {expanded && (
        <div>
          {sorted.map((item) => (
            <BranchRow
              key={item.fullname}
              item={item}
              isFavorite={favorites.has(item.fullname)}
              showFullPath
              onOpenJob={onOpenJob}
              onToggleFavorite={onToggleFavorite}
              onTriggerBuild={onTriggerBuild}
              triggeringJob={triggeringJob}
              indent={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Single branch/job row */
function BranchRow({
  item,
  isFavorite,
  showFullPath,
  onOpenJob,
  onToggleFavorite,
  onTriggerBuild,
  triggeringJob,
  indent
}: {
  item: JenkinsItem
  isFavorite: boolean
  showFullPath?: boolean
  onOpenJob: (fullname: string) => void
  onToggleFavorite: (e: React.MouseEvent, fullname: string) => void
  onTriggerBuild: (e: React.MouseEvent, fullname: string) => void
  triggeringJob: string | null
  indent: number
}) {
  const status = colorToStatus(item.color)
  const parts = item.fullname.split('/')
  const branchName = parts.pop() || item.name
  const parentPath = parts.join('/')
  const paddingLeft = indent === 2 ? 'pl-14' : 'pl-10'

  return (
    <button
      onClick={() => onOpenJob(item.fullname)}
      className={`w-full flex items-center gap-3 px-4 py-2 ${paddingLeft} hover:bg-slate-900/50 transition group`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dotClass}`}
      />
      <div className="flex-1 min-w-0 text-left truncate">
        {showFullPath && parentPath && (
          <span className="text-slate-500 text-sm">{parentPath}<span className="mx-1 text-slate-600">/</span></span>
        )}
        <span className="text-sm text-slate-200">{branchName}</span>
      </div>
      <span className={`text-xs ${status.class} shrink-0`}>
        {status.label}
      </span>
      {item.lastBuild && (
        <span className="text-xs text-slate-500 shrink-0">
          #{item.lastBuild.number}
        </span>
      )}
      <button
        onClick={(e) => onToggleFavorite(e, item.fullname)}
        className={`p-1 rounded transition shrink-0 ${
          isFavorite
            ? 'text-amber-400 hover:text-amber-300'
            : 'opacity-0 group-hover:opacity-100 text-slate-600 hover:text-amber-400'
        }`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star size={12} className={isFavorite ? 'fill-amber-400' : ''} />
      </button>
      <button
        onClick={(e) => onTriggerBuild(e, item.fullname)}
        disabled={triggeringJob === item.fullname}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition shrink-0"
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
}
