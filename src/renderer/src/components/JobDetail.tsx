import { useState, useEffect, useCallback, useMemo } from 'react'
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
  ChevronRight,
  MessageSquare,
  TestTube,
  FileText,
  GitCompare
} from 'lucide-react'
import { useBuildHistory } from '../hooks/useJenkins'
import { resultToStyle, formatDuration, timeAgo, formatTime, parseFullname } from '../lib/utils'
import ConsoleOutput from './ConsoleOutput'
import InputDialog from './InputDialog'
import TestResultsView from './TestResultsView'
import StageLogView from './StageLogView'

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

// Sub-views for the job detail page
type SubView =
  | null
  | { type: 'console'; buildNumber: number }
  | { type: 'tests'; buildNumber: number }
  | { type: 'stageLog'; buildNumber: number; stageId: string; stageName: string }
  | { type: 'compare'; buildA: number; buildB: number }

export default function JobDetail({ fullname, onBack }: Props) {
  const { data: builds, loading, refresh } = useBuildHistory(fullname, 30)
  const [selectedBuild, setSelectedBuild] = useState<number | null>(null)
  const [subView, setSubView] = useState<SubView>(null)
  const [triggeringBuild, setTriggeringBuild] = useState(false)
  const [expandedBuild, setExpandedBuild] = useState<number | null>(null)
  const [comparePick, setComparePick] = useState<number | null>(null)

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

  // Duration trend sparkline data (last 20 completed builds)
  const trendData = useMemo(() => {
    if (!builds) return null
    const completed = builds.filter((b) => !b.building && b.duration > 0).slice(0, 20).reverse()
    if (completed.length < 2) return null
    return completed.map((b) => ({
      number: b.number,
      duration: b.duration,
      result: b.result
    }))
  }, [builds])

  // Render sub-views
  if (subView?.type === 'console') {
    return (
      <ConsoleOutput
        fullname={fullname}
        buildNumber={subView.buildNumber}
        onBack={() => setSubView(null)}
      />
    )
  }

  if (subView?.type === 'tests') {
    return (
      <TestResultsView
        fullname={fullname}
        buildNumber={subView.buildNumber}
        onBack={() => setSubView(null)}
      />
    )
  }

  if (subView?.type === 'stageLog') {
    return (
      <StageLogView
        fullname={fullname}
        buildNumber={subView.buildNumber}
        stageId={subView.stageId}
        stageName={subView.stageName}
        onBack={() => setSubView(null)}
      />
    )
  }

  if (subView?.type === 'compare') {
    return (
      <BuildCompareView
        fullname={fullname}
        buildA={subView.buildA}
        buildB={subView.buildB}
        onBack={() => setSubView(null)}
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

      {/* Duration trend sparkline */}
      {trendData && (
        <div className="px-4 py-2 border-b border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={10} className="text-slate-600" />
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">Duration Trend</span>
          </div>
          <DurationSparkline data={trendData} />
        </div>
      )}

      {/* Compare mode hint */}
      {comparePick !== null && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 border-b border-blue-700/30">
          <GitCompare size={12} className="text-blue-400" />
          <span className="text-xs text-blue-300">
            Comparing #{comparePick} — click another build to compare
          </span>
          <button
            onClick={() => setComparePick(null)}
            className="ml-auto text-xs text-blue-400 hover:text-blue-200 transition"
          >
            Cancel
          </button>
        </div>
      )}

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
                    onClick={() => {
                      if (comparePick !== null) {
                        if (comparePick !== build.number) {
                          setSubView({ type: 'compare', buildA: comparePick, buildB: build.number })
                          setComparePick(null)
                        }
                        return
                      }
                      setExpandedBuild(isExpanded ? null : build.number)
                    }}
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
                          setSubView({ type: 'console', buildNumber: build.number })
                        }}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title="Console output"
                      >
                        <Terminal size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSubView({ type: 'tests', buildNumber: build.number })
                        }}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                        title="Test results"
                      >
                        <TestTube size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setComparePick(build.number)
                        }}
                        className={`p-1 rounded transition ${comparePick === build.number ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}
                        title="Compare with another build"
                      >
                        <GitCompare size={12} />
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
                    <StagesPanel
                      fullname={fullname}
                      buildNumber={build.number}
                      isBuilding={isRunning}
                      onViewStageLog={(stageId, stageName) =>
                        setSubView({ type: 'stageLog', buildNumber: build.number, stageId, stageName })
                      }
                    />
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

/** Duration trend sparkline */
function DurationSparkline({ data }: { data: { number: number; duration: number; result?: string }[] }) {
  const max = Math.max(...data.map((d) => d.duration))
  const height = 24
  const width = Math.min(data.length * 12, 300)
  const barWidth = Math.max(4, (width / data.length) - 2)

  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((d, i) => {
        const h = Math.max(2, (d.duration / max) * height)
        const x = i * (barWidth + 2)
        const color = d.result === 'FAILURE' ? '#ef4444'
          : d.result === 'UNSTABLE' ? '#eab308'
          : d.result === 'ABORTED' ? '#64748b'
          : '#22c55e'
        return (
          <g key={d.number}>
            <rect
              x={x}
              y={height - h}
              width={barWidth}
              height={h}
              rx={1}
              fill={color}
              opacity={0.7}
            >
              <title>#{d.number}: {formatDuration(d.duration)}</title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

/** Local cache for completed build stages — avoids re-fetching on expand/collapse */
const stagesCache = new Map<string, JenkinsStage[]>()

/** Lazy-loaded stages panel for a single build */
function StagesPanel({
  fullname,
  buildNumber,
  isBuilding,
  onViewStageLog
}: {
  fullname: string
  buildNumber: number
  isBuilding?: boolean
  onViewStageLog: (stageId: string, stageName: string) => void
}) {
  const cacheKey = `${fullname}:${buildNumber}`
  const [stages, setStages] = useState<JenkinsStage[] | null>(
    stagesCache.get(cacheKey) ?? null
  )
  const [loading, setLoading] = useState(!stagesCache.has(cacheKey))
  const [error, setError] = useState(false)
  const [pendingInputs, setPendingInputs] = useState<JenkinsPendingInput[]>([])
  const [activeInput, setActiveInput] = useState<JenkinsPendingInput | null>(null)

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

      // Check for pending inputs if any stage is paused
      const hasPaused = data.some((s) => s.status === 'PAUSED_PENDING_INPUT')
      if (hasPaused) {
        const inputs = await window.api.jenkins.getPendingInputs(fullname, buildNumber)
        setPendingInputs(inputs)
      } else {
        setPendingInputs([])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fullname, buildNumber, cacheKey])

  useEffect(() => {
    fetchStages()
    // If building, poll stages more frequently to catch input prompts
    if (isBuilding) {
      const timer = setInterval(fetchStages, 10000)
      return () => clearInterval(timer)
    }
  }, [fetchStages, isBuilding])

  const handleInputDone = () => {
    setActiveInput(null)
    setPendingInputs([])
    // Refresh stages after input action
    stagesCache.delete(cacheKey)
    fetchStages()
  }

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
      {/* Pending Input banner */}
      {pendingInputs.length > 0 && (
        <div className="mb-3 space-y-2">
          {pendingInputs.map((input) => (
            <div
              key={input.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded border border-amber-500/30 bg-amber-500/10"
            >
              <MessageSquare size={14} className="text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-200 truncate">{input.message}</p>
                {input.parameters && input.parameters.length > 0 && (
                  <p className="text-xs text-amber-400/60 mt-0.5">
                    {input.parameters.length} parameter{input.parameters.length !== 1 ? 's' : ''} required
                  </p>
                )}
              </div>
              <button
                onClick={() => setActiveInput(input)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition shrink-0"
              >
                Respond
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline visualization: connected stage boxes */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const style = getStageStyle(stage.status)
          const isPaused = stage.status === 'PAUSED_PENDING_INPUT'
          return (
            <div key={stage.id} className="flex items-center shrink-0">
              {i > 0 && (
                <div className="w-4 h-px bg-slate-700 shrink-0" />
              )}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs ${style.bg} cursor-pointer hover:brightness-125 transition`}
                title={`${stage.name}: ${stage.status} (${formatDuration(stage.durationMillis)}) — Click for log`}
                onClick={() => {
                  if (isPaused && pendingInputs.length > 0) {
                    setActiveInput(pendingInputs[0])
                  } else {
                    onViewStageLog(stage.id, stage.name)
                  }
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <span className={`${style.text} whitespace-nowrap font-medium`}>
                  {stage.name}
                </span>
                {isPaused && (
                  <MessageSquare size={10} className="text-amber-400" />
                )}
                {stage.durationMillis > 0 && (
                  <span className="text-slate-500 whitespace-nowrap">
                    {formatDuration(stage.durationMillis)}
                  </span>
                )}
                <FileText size={9} className="text-slate-600 ml-0.5" />
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
            <div
              key={stage.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/30 rounded transition px-1"
              onClick={() => onViewStageLog(stage.id, stage.name)}
            >
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

      {/* Input Dialog */}
      {activeInput && (
        <InputDialog
          fullname={fullname}
          buildNumber={buildNumber}
          input={activeInput}
          onDone={handleInputDone}
          onCancel={() => setActiveInput(null)}
        />
      )}
    </div>
  )
}

/** Build comparison view */
function BuildCompareView({
  fullname,
  buildA,
  buildB,
  onBack
}: {
  fullname: string
  buildA: number
  buildB: number
  onBack: () => void
}) {
  const [stagesA, setStagesA] = useState<JenkinsStage[] | null>(null)
  const [stagesB, setStagesB] = useState<JenkinsStage[] | null>(null)
  const [buildInfoA, setBuildInfoA] = useState<JenkinsBuild | null>(null)
  const [buildInfoB, setBuildInfoB] = useState<JenkinsBuild | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.jenkins.getStages(fullname, buildA),
      window.api.jenkins.getStages(fullname, buildB),
      window.api.jenkins.getBuild(fullname, buildA),
      window.api.jenkins.getBuild(fullname, buildB)
    ]).then(([sA, sB, bA, bB]) => {
      setStagesA(sA)
      setStagesB(sB)
      setBuildInfoA(bA)
      setBuildInfoB(bB)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [fullname, buildA, buildB])

  const allStageNames = useMemo(() => {
    const names = new Set<string>()
    stagesA?.forEach((s) => names.add(s.name))
    stagesB?.forEach((s) => names.add(s.name))
    return [...names]
  }, [stagesA, stagesB])

  return (
    <div className="h-full flex flex-col">
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button
          onClick={onBack}
          className="titlebar-no-drag p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="titlebar-no-drag flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-200">
            Compare: #{buildA} vs #{buildB}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw size={20} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          {/* Build summary comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[{ build: buildInfoA, num: buildA }, { build: buildInfoB, num: buildB }].map(({ build, num }) => {
              const style = build ? resultToStyle(build.result) : { label: '?', class: 'text-slate-500', bgClass: 'bg-slate-800/50' }
              return (
                <div key={num} className={`p-3 rounded border ${style.bgClass}`}>
                  <div className={`text-sm font-mono font-medium ${style.class}`}>#{num} — {style.label}</div>
                  {build && (
                    <div className="text-xs text-slate-500 mt-1">
                      Duration: {formatDuration(build.duration)} | {timeAgo(build.timestamp)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Stage comparison table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 text-slate-500 font-medium">Stage</th>
                <th className="text-center py-2 text-slate-500 font-medium">#{buildA}</th>
                <th className="text-center py-2 text-slate-500 font-medium">#{buildB}</th>
                <th className="text-right py-2 text-slate-500 font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              {allStageNames.map((name) => {
                const sA = stagesA?.find((s) => s.name === name)
                const sB = stagesB?.find((s) => s.name === name)
                const delta = (sA?.durationMillis ?? 0) - (sB?.durationMillis ?? 0)
                const deltaColor = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-600'
                return (
                  <tr key={name} className="border-b border-slate-800/50">
                    <td className="py-1.5 text-slate-300">{name}</td>
                    <td className="py-1.5 text-center">
                      {sA ? (
                        <span className={getStageStyle(sA.status).text}>
                          {formatDuration(sA.durationMillis)}
                        </span>
                      ) : (
                        <span className="text-slate-700">-</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      {sB ? (
                        <span className={getStageStyle(sB.status).text}>
                          {formatDuration(sB.durationMillis)}
                        </span>
                      ) : (
                        <span className="text-slate-700">-</span>
                      )}
                    </td>
                    <td className={`py-1.5 text-right ${deltaColor}`}>
                      {sA && sB ? (delta > 0 ? '+' : '') + formatDuration(Math.abs(delta)) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
