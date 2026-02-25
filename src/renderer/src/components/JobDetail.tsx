import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Play,
  Square,
  Clock,
  Hash,
  ExternalLink,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useBuildHistory } from '../hooks/useJenkins'
import { resultToStyle, formatDuration, timeAgo, formatTime, parseFullname } from '../lib/utils'
import ConsoleOutput from './ConsoleOutput'

interface Props {
  fullname: string
  onBack: () => void
}

const stageStatusColor: Record<string, { dot: string; text: string; bg: string }> = {
  SUCCESS: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20'
  },
  FAILED: {
    dot: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20'
  },
  IN_PROGRESS: {
    dot: 'bg-blue-400 animate-pulse',
    text: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20'
  },
  UNSTABLE: {
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20'
  },
  ABORTED: {
    dot: 'bg-slate-500',
    text: 'text-slate-500',
    bg: 'bg-slate-500/10 border-slate-500/20'
  },
  NOT_EXECUTED: {
    dot: 'bg-slate-700',
    text: 'text-slate-600',
    bg: 'bg-slate-800/50 border-slate-700/30'
  },
  PAUSED_PENDING_INPUT: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20'
  }
}

function getStageStyle(status: string) {
  return stageStatusColor[status] || stageStatusColor.NOT_EXECUTED
}

export default function JobDetail({ fullname, onBack }: Props) {
  const { data: builds, loading, refresh } = useBuildHistory(fullname, 30)
  const [selectedBuild, setSelectedBuild] = useState<number | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [triggeringBuild, setTriggeringBuild] = useState(false)
  const [expandedBuild, setExpandedBuild] = useState<number | null>(null)

  const { folder, name } = parseFullname(fullname)

  const handleTriggerBuild = async () => {
    setTriggeringBuild(true)
    try {
      await window.api.jenkins.buildItem(fullname)
      setTimeout(refresh, 3000)
    } catch (err) {
      console.error('Failed to trigger build:', err)
    } finally {
      setTriggeringBuild(false)
    }
  }

  const handleStopBuild = async (buildNumber: number) => {
    try {
      await window.api.jenkins.stopBuild(fullname, buildNumber)
      setTimeout(refresh, 2000)
    } catch (err) {
      console.error('Failed to stop build:', err)
    }
  }

  if (showConsole && selectedBuild !== null) {
    return (
      <ConsoleOutput
        fullname={fullname}
        buildNumber={selectedBuild}
        onBack={() => setShowConsole(false)}
      />
    )
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
          {folder && (
            <span className="text-xs text-slate-500">{folder}/</span>
          )}
          <h1 className="text-sm font-semibold text-slate-200 truncate">{name}</h1>
        </div>
        <button
          onClick={handleTriggerBuild}
          disabled={triggeringBuild}
          className="titlebar-no-drag flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 transition disabled:opacity-50"
        >
          <Play size={12} className={triggeringBuild ? 'animate-pulse' : ''} />
          Build
        </button>
        <button
          onClick={refresh}
          disabled={loading}
          className="titlebar-no-drag p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Build history */}
      <div className="flex-1 overflow-auto">
        {loading && !builds ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : !builds?.length ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            No builds found
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {builds.map((build) => {
              const style = resultToStyle(build.result)
              const isRunning = build.building
              const elapsed = isRunning
                ? Date.now() - build.timestamp
                : build.duration
              const isExpanded = expandedBuild === build.number

              return (
                <div key={build.number}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900/50 transition group cursor-pointer"
                    onClick={() => setExpandedBuild(isExpanded ? null : build.number)}
                  >
                    {/* Expand chevron */}
                    <span className="text-slate-600 w-3">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>

                    {/* Build number + status badge */}
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono ${style.bgClass}`}
                    >
                      <Hash size={10} />
                      <span className={style.class}>{build.number}</span>
                    </div>

                    {/* Status label */}
                    <span className={`text-xs font-medium w-16 ${style.class}`}>
                      {style.label}
                    </span>

                    {/* Duration */}
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={10} />
                      <span>{formatDuration(elapsed)}</span>
                    </div>

                    {/* Progress bar for running builds */}
                    {isRunning && build.estimatedDuration > 0 && (
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(100, (elapsed / build.estimatedDuration) * 100)}%`
                          }}
                        />
                      </div>
                    )}

                    {/* Time ago */}
                    <span className="text-xs text-slate-500 ml-auto" title={formatTime(build.timestamp)}>
                      {timeAgo(build.timestamp)}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedBuild(build.number)
                          setShowConsole(true)
                        }}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title="Console output"
                      >
                        <Terminal size={12} />
                      </button>
                      {isRunning && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStopBuild(build.number)
                          }}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                          title="Stop build"
                        >
                          <Square size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(build.url, '_blank')
                        }}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title="Open in Jenkins"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Stages panel */}
                  {isExpanded && (
                    <StagesPanel fullname={fullname} buildNumber={build.number} />
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

/** Local cache for completed build stages — avoids re-fetching on expand/collapse */
const stagesCache = new Map<string, JenkinsStage[]>()

/** Lazy-loaded stages panel for a single build */
function StagesPanel({ fullname, buildNumber }: { fullname: string; buildNumber: number }) {
  const cacheKey = `${fullname}:${buildNumber}`
  const [stages, setStages] = useState<JenkinsStage[] | null>(
    stagesCache.get(cacheKey) ?? null
  )
  const [loading, setLoading] = useState(!stagesCache.has(cacheKey))
  const [error, setError] = useState(false)

  const fetchStages = useCallback(async () => {
    // Skip fetch if we already have cached completed stages
    if (stagesCache.has(cacheKey)) {
      setStages(stagesCache.get(cacheKey)!)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const data = await window.api.jenkins.getStages(fullname, buildNumber)
      setStages(data)
      // Cache stages if the build is completed (all stages have a terminal status)
      const isCompleted = data.length > 0 &&
        data.every((s) => s.status !== 'IN_PROGRESS' && s.status !== 'PAUSED_PENDING_INPUT')
      if (isCompleted) {
        stagesCache.set(cacheKey, data)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fullname, buildNumber, cacheKey])

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  if (loading) {
    return (
      <div className="px-8 py-3 bg-slate-900/30">
        <RefreshCw size={14} className="animate-spin text-slate-600" />
      </div>
    )
  }

  if (error || !stages || stages.length === 0) {
    return (
      <div className="px-8 py-3 bg-slate-900/30 text-xs text-slate-600">
        {error ? 'Failed to load stages' : 'No pipeline stages'}
      </div>
    )
  }

  // Find the longest stage for relative bar sizing
  const maxDuration = Math.max(...stages.map((s) => s.durationMillis), 1)

  return (
    <div className="px-6 py-3 bg-slate-900/30 border-t border-slate-800/30">
      {/* Pipeline visualization: connected stage boxes */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const style = getStageStyle(stage.status)
          return (
            <div key={stage.id} className="flex items-center shrink-0">
              {i > 0 && (
                <div className="w-4 h-px bg-slate-700 shrink-0" />
              )}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs ${style.bg}`}
                title={`${stage.name}: ${stage.status} (${formatDuration(stage.durationMillis)})`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <span className={`${style.text} whitespace-nowrap font-medium`}>
                  {stage.name}
                </span>
                {stage.durationMillis > 0 && (
                  <span className="text-slate-500 whitespace-nowrap">
                    {formatDuration(stage.durationMillis)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stage detail bars */}
      <div className="mt-2 space-y-1">
        {stages.map((stage) => {
          const style = getStageStyle(stage.status)
          const widthPercent = Math.max(2, (stage.durationMillis / maxDuration) * 100)
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-28 truncate text-right shrink-0">
                {stage.name}
              </span>
              <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.dot.replace('animate-pulse', '')}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-600 w-14 shrink-0">
                {stage.durationMillis > 0 ? formatDuration(stage.durationMillis) : '-'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
