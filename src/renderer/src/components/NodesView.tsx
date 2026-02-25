import { RefreshCw, Server, Cpu, Circle, ExternalLink } from 'lucide-react'
import { useNodes } from '../hooks/useJenkins'
import { timeAgo } from '../lib/utils'

export default function NodesView() {
  const { data: nodes, loading, refresh } = useNodes()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <Server size={16} className="titlebar-no-drag text-slate-400" />
        <h1 className="titlebar-no-drag text-sm font-semibold text-slate-200">Nodes</h1>
        <div className="flex-1" />
        <button
          onClick={refresh}
          disabled={loading}
          className="titlebar-no-drag p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Nodes grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading && !nodes ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {nodes?.map((node) => {
              const busyExecutors = node.executors?.filter(
                (e) => e.currentExecutable
              ).length ?? 0
              const totalExecutors = node.executors?.length ?? 0
              const utilization = totalExecutors > 0 ? (busyExecutors / totalExecutors) * 100 : 0

              return (
                <div
                  key={node.displayName}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                >
                  {/* Node header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Circle
                      size={8}
                      fill={node.offline ? '#64748b' : '#22c55e'}
                      className={node.offline ? 'text-slate-500' : 'text-emerald-400'}
                    />
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {node.displayName}
                    </span>
                    <span
                      className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                        node.offline
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-emerald-400/10 text-emerald-400'
                      }`}
                    >
                      {node.offline ? 'Offline' : 'Online'}
                    </span>
                  </div>

                  {/* Utilization bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Executors</span>
                      <span>
                        {busyExecutors}/{totalExecutors} busy
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilization > 80
                            ? 'bg-amber-500'
                            : utilization > 0
                              ? 'bg-blue-500'
                              : 'bg-slate-700'
                        }`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                  </div>

                  {/* Running executables */}
                  {node.executors
                    ?.filter((e) => e.currentExecutable)
                    .map((exec, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 py-1.5 border-t border-slate-800"
                      >
                        <Cpu size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">
                            {exec.currentExecutable!.fullDisplayName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Started {timeAgo(exec.currentExecutable!.timestamp)}
                          </p>
                        </div>
                        <button
                          onClick={() => window.open(exec.currentExecutable!.url, '_blank')}
                          className="p-0.5 text-slate-500 hover:text-slate-300 transition"
                        >
                          <ExternalLink size={10} />
                        </button>
                      </div>
                    ))}

                  {busyExecutors === 0 && !node.offline && (
                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                      All executors idle
                    </p>
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
