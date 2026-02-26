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
  Layers,
  List
} from 'lucide-react'
import { useFavoriteItems, useJenkinsItems } from '../hooks/useJenkins'
import { colorToStatus, groupHierarchically, sortFolderGroups, sortJobsByStatus } from '../lib/utils'
import BuildParamsDialog from './BuildParamsDialog'
import FailedTestsInline from './FailedTestsInline'
import BuildCommitsInline from './BuildCommitsInline'
import PendingInputInline from './PendingInputInline'

type StatusFilter = 'all' | 'failed' | 'running' | 'unstable' | 'success'

interface Props {
  onOpenJob: (fullname: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export default function Dashboard({ onOpenJob, searchInputRef }: Props) {
  // Lightweight fetch: only favorites + pinned folders
  const { data: favItems, loading: favLoading, error: favError, refresh: favRefresh } = useFavoriteItems()

  // Full fetch: all 6600+ items — only enabled when browsing or searching
  const [browseAll, setBrowseAll] = useState(false)
  const { data: allItems, loading: allLoading, refresh: allRefresh } = useJenkinsItems(browseAll ? 30000 : 0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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

  // Debounce search — trigger full fetch only after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Enable full fetch when searching or filtering
  const needsFullData = debouncedSearch.length > 0 || statusFilter !== 'all' || browseAll || groupByView
  useEffect(() => {
    if (needsFullData && !allItems && !allLoading) {
      // Will be fetched by the hook once browseAll or search enables it
    }
  }, [needsFullData, allItems, allLoading])

  // The active dataset depends on the mode
  const items = needsFullData ? allItems : favItems
  const loading = needsFullData ? allLoading : favLoading
  const error = favError
  const refresh = needsFullData ? allRefresh : favRefresh

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
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase()
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
  }, [items, debouncedSearch, statusFilter])

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

  // In default mode, pinned folder items (excluding favorites which are shown separately)
  const pinnedFolderItems = useMemo(() => {
    if (needsFullData || !items) return []
    const pinnedSet = new Set(pinnedFolders)
    return items.filter((item) => {
      if (favorites.has(item.fullname)) return false
      const topFolder = item.fullname.split('/')[0]
      return pinnedSet.has(topFolder)
    })
  }, [items, pinnedFolders, favorites, needsFullData])

  const pinnedGrouped = useMemo(() => groupHierarchically(pinnedFolderItems), [pinnedFolderItems])
  const pinnedSorted = useMemo(
    () => sortFolderGroups(pinnedGrouped, pinnedFolders),
    [pinnedGrouped, pinnedFolders]
  )

  // Auto-expand all folders and jobs when searching
  useMemo(() => {
    if (debouncedSearch || statusFilter !== 'all') {
      setExpandedFolders(new Set(sortedGroups.map((g) => g.folder)))
      const allJobKeys = new Set<string>()
      for (const fg of sortedGroups) {
        for (const jg of fg.jobs) {
          allJobKeys.add(`${fg.folder}/${jg.job}`)
        }
      }
      setExpandedJobs(allJobKeys)
    }
  }, [debouncedSearch, statusFilter, sortedGroups])

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
    try {
      const params = await window.api.jenkins.getBuildParameters(fullname)
      if (params.length > 0) {
        setBuildParamsJob(fullname)
        return
      }
    } catch { /* ignore */ }
    doTriggerBuild(fullname)
  }

  const doTriggerBuild = async (fullname: string, params?: Record<string, string>) => {
    setTriggeringJob(fullname)
    setBuildParamsJob(null)
    try {
      await window.api.jenkins.buildItem(fullname, params)
      setTimeout(() => { favRefresh(); if (browseAll) allRefresh() }, 2000)
    } catch (err) {
      console.error('Failed to trigger build:', err)
    } finally {
      setTriggeringJob(null)
    }
  }

  // Status filter counts — only available in full data mode
  const filterCounts = useMemo(() => {
    const source = needsFullData ? allItems : items
    if (!source) return { failed: 0, running: 0, unstable: 0, success: 0 }
    let failed = 0, running = 0, unstable = 0, success = 0
    for (const item of source) {
      const base = item.color?.replace('_anime', '') || 'notbuilt'
      if (item.color?.endsWith('_anime')) running++
      if (base === 'red') failed++
      else if (base === 'yellow') unstable++
      else if (base === 'blue' || base === 'green') success++
    }
    return { failed, running, unstable, success }
  }, [needsFullData, allItems, items])

  // Handle search input: enable full data mode when typing
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    if (e.target.value && !browseAll) {
      setBrowseAll(true)
    }
    if (!e.target.value && statusFilter === 'all' && !groupByView) {
      // Return to lightweight mode when search is cleared
      setBrowseAll(false)
    }
  }, [browseAll, statusFilter, groupByView])

  const handleStatusFilter = useCallback((key: StatusFilter) => {
    setStatusFilter(key)
    if (key !== 'all') {
      setBrowseAll(true)
    } else if (!search && !groupByView) {
      setBrowseAll(false)
    }
  }, [search, groupByView])

  const handleGroupByView = useCallback(() => {
    const next = !groupByView
    setGroupByView(next)
    if (next) setBrowseAll(true)
    else if (!search && statusFilter === 'all') setBrowseAll(false)
  }, [groupByView, search, statusFilter])

  const handleBrowseAll = useCallback(() => {
    setBrowseAll(true)
  }, [])

  const handleBackToFavorites = useCallback(() => {
    setBrowseAll(false)
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setGroupByView(false)
  }, [])

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
            onChange={handleSearchChange}
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
            onClick={handleGroupByView}
            className={`titlebar-no-drag p-1.5 rounded transition ${groupByView ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title="Group by Jenkins Views"
          >
            <Layers size={14} />
          </button>
        )}
        {!needsFullData ? (
          <button
            onClick={handleBrowseAll}
            className="titlebar-no-drag flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition"
            title="Browse all jobs"
          >
            <List size={12} />
            <span>Browse all</span>
          </button>
        ) : (
          <button
            onClick={handleBackToFavorites}
            className="titlebar-no-drag flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded transition"
            title="Back to favorites view"
          >
            <Star size={12} className="fill-amber-400" />
            <span>Favorites</span>
          </button>
        )}
        <span className="titlebar-no-drag text-xs text-slate-500">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status filter bar — only show in full data mode */}
      {needsFullData && (
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
              onClick={() => handleStatusFilter(key)}
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
      )}

      {/* Jobs list */}
      <div className="flex-1 overflow-auto">
        {loading && !items ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : needsFullData ? (
          /* Full data mode: search/filter/browse all */
          allLoading && !allItems ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={20} className="animate-spin text-slate-500" />
              <span className="ml-2 text-sm text-slate-500">Loading all jobs...</span>
            </div>
          ) : groupByView && viewGroups ? (
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
              {/* Favorites section in full mode */}
              {favoriteItems.length > 0 && !debouncedSearch && statusFilter === 'all' && (
                <FavoritesSection
                  favoriteItems={favoriteItems}
                  onOpenJob={onOpenJob}
                  onToggleFavorite={toggleFavorite}
                  onTriggerBuild={handleTriggerBuild}
                  triggeringJob={triggeringJob}
                />
              )}

              {/* Folder > Job > Branch hierarchy */}
              {sortedGroups.map((folderGroup) => (
                <FolderSection
                  key={folderGroup.folder}
                  folderGroup={folderGroup}
                  isExpanded={expandedFolders.has(folderGroup.folder)}
                  isPinned={pinnedFolders.includes(folderGroup.folder)}
                  expandedJobs={expandedJobs}
                  favorites={favorites}
                  onToggleFolder={toggleFolder}
                  onToggleJob={toggleJob}
                  onOpenJob={onOpenJob}
                  onToggleFavorite={toggleFavorite}
                  onTogglePin={togglePin}
                  onTriggerBuild={handleTriggerBuild}
                  triggeringJob={triggeringJob}
                />
              ))}
            </div>
          )
        ) : (
          /* Default lightweight mode: favorites + pinned folders only */
          <div className="divide-y divide-slate-800/50">
            {/* Favorites section */}
            {favoriteItems.length > 0 && (
              <FavoritesSection
                favoriteItems={favoriteItems}
                onOpenJob={onOpenJob}
                onToggleFavorite={toggleFavorite}
                onTriggerBuild={handleTriggerBuild}
                triggeringJob={triggeringJob}
              />
            )}

            {/* Pinned folders */}
            {pinnedSorted.map((folderGroup) => (
              <FolderSection
                key={folderGroup.folder}
                folderGroup={folderGroup}
                isExpanded={expandedFolders.has(folderGroup.folder)}
                isPinned={true}
                expandedJobs={expandedJobs}
                favorites={favorites}
                onToggleFolder={toggleFolder}
                onToggleJob={toggleJob}
                onOpenJob={onOpenJob}
                onToggleFavorite={toggleFavorite}
                onTogglePin={togglePin}
                onTriggerBuild={handleTriggerBuild}
                triggeringJob={triggeringJob}
              />
            ))}

            {/* Empty state */}
            {favoriteItems.length === 0 && pinnedSorted.length === 0 && !favLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Star size={32} className="text-slate-700" />
                <p className="text-sm text-slate-500">No favorites or pinned folders yet</p>
                <p className="text-xs text-slate-600">Star jobs or pin folders to see them here</p>
                <button
                  onClick={handleBrowseAll}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition"
                >
                  <List size={14} />
                  Browse all jobs
                </button>
              </div>
            )}
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

/** Favorites section with inline details */
function FavoritesSection({
  favoriteItems,
  onOpenJob,
  onToggleFavorite,
  onTriggerBuild,
  triggeringJob
}: {
  favoriteItems: JenkinsItem[]
  onOpenJob: (fullname: string) => void
  onToggleFavorite: (e: React.MouseEvent, fullname: string) => void
  onTriggerBuild: (e: React.MouseEvent, fullname: string) => void
  triggeringJob: string | null
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border-b border-slate-800/50">
        <Star size={14} className="text-amber-400 fill-amber-400" />
        <span className="font-medium text-amber-300 text-sm">Favorites</span>
        <span className="text-xs text-slate-500">({favoriteItems.length})</span>
      </div>
      <div>
        {favoriteItems.map((item) => {
          const base = item.color?.replace('_anime', '') || 'notbuilt'
          const isRunning = item.color?.endsWith('_anime')
          const hasFailed = base === 'red' || base === 'yellow'
          return (
            <div key={`fav-${item.fullname}`}>
              <BranchRow
                item={item}
                isFavorite={true}
                showFullPath
                onOpenJob={onOpenJob}
                onToggleFavorite={onToggleFavorite}
                onTriggerBuild={onTriggerBuild}
                triggeringJob={triggeringJob}
                indent={1}
              />
              {item.lastBuild && (
                <BuildCommitsInline
                  fullname={item.fullname}
                  buildNumber={item.lastBuild.number}
                />
              )}
              {isRunning && item.lastBuild && (
                <PendingInputInline
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
  )
}

/** Folder section with expandable jobs */
function FolderSection({
  folderGroup,
  isExpanded,
  isPinned,
  expandedJobs,
  favorites,
  onToggleFolder,
  onToggleJob,
  onOpenJob,
  onToggleFavorite,
  onTogglePin,
  onTriggerBuild,
  triggeringJob
}: {
  folderGroup: { folder: string; jobs: { folder: string; job: string; branches: JenkinsItem[] }[]; allItems: JenkinsItem[] }
  isExpanded: boolean
  isPinned: boolean
  expandedJobs: Set<string>
  favorites: Set<string>
  onToggleFolder: (folder: string) => void
  onToggleJob: (key: string) => void
  onOpenJob: (fullname: string) => void
  onToggleFavorite: (e: React.MouseEvent, fullname: string) => void
  onTogglePin: (e: React.MouseEvent, folder: string) => void
  onTriggerBuild: (e: React.MouseEvent, fullname: string) => void
  triggeringJob: string | null
}) {
  const failedCount = folderGroup.allItems.filter(
    (j) => j.color === 'red' || j.color === 'red_anime'
  ).length
  const runningCount = folderGroup.allItems.filter(
    (j) => j.color?.endsWith('_anime')
  ).length

  return (
    <div>
      {/* Folder header */}
      <button
        onClick={() => onToggleFolder(folderGroup.folder)}
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
          onClick={(e) => onTogglePin(e, folderGroup.folder)}
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
                  onToggleFavorite={onToggleFavorite}
                  onTriggerBuild={onTriggerBuild}
                  triggeringJob={triggeringJob}
                  indent={1}
                />
              )
            }

            return (
              <div key={jobKey}>
                {/* Job sub-header */}
                <button
                  onClick={() => onToggleJob(jobKey)}
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
                        onToggleFavorite={onToggleFavorite}
                        onTriggerBuild={onTriggerBuild}
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
