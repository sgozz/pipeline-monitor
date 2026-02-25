import { useState } from 'react'
import {
  ArrowLeft,
  Play,
  Square,
  Clock,
  Hash,
  ExternalLink,
  RefreshCw,
  Terminal
} from 'lucide-react'
import { useBuildHistory } from '../hooks/useJenkins'
import { resultToStyle, formatDuration, timeAgo, formatTime, parseFullname } from '../lib/utils'
import ConsoleOutput from './ConsoleOutput'

interface Props {
  fullname: string
  onBack: () => void
}

export default function JobDetail({ fullname, onBack }: Props) {
  const { data: builds, loading, refresh } = useBuildHistory(fullname, 30)
  const [selectedBuild, setSelectedBuild] = useState<number | null>(null)
  const [showConsole, setShowConsole] = useState(false)
  const [triggeringBuild, setTriggeringBuild] = useState(false)

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

              return (
                <div
                  key={build.number}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900/50 transition group"
                >
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
                      onClick={() => {
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
                        onClick={() => handleStopBuild(build.number)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                        title="Stop build"
                      >
                        <Square size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => window.open(build.url, '_blank')}
                      className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                      title="Open in Jenkins"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
