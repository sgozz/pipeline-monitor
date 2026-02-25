import { RefreshCw, ListOrdered, X, Clock } from 'lucide-react'
import { useQueue } from '../hooks/useJenkins'
import { timeAgo, formatTime } from '../lib/utils'

export default function QueueView() {
  const { data: queue, loading, refresh } = useQueue()

  const handleCancel = async (id: number) => {
    try {
      await window.api.jenkins.cancelQueueItem(id)
      setTimeout(refresh, 1000)
    } catch (err) {
      console.error('Failed to cancel queue item:', err)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <ListOrdered size={16} className="titlebar-no-drag text-slate-400" />
        <h1 className="titlebar-no-drag text-sm font-semibold text-slate-200">Build Queue</h1>
        <span className="titlebar-no-drag text-xs text-slate-500">
          {queue?.length ?? 0} item{(queue?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={refresh}
          disabled={loading}
          className="titlebar-no-drag p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-auto">
        {loading && !queue ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw size={20} className="animate-spin text-slate-500" />
          </div>
        ) : !queue?.length ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <ListOrdered size={24} className="mb-2 opacity-50" />
            <span className="text-sm">Queue is empty</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-900/50 transition group"
              >
                {/* Queue position */}
                <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-slate-400 font-mono">{item.id}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">
                    {item.task?.name || `Queue Item #${item.id}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.why}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <Clock size={10} />
                    <span title={formatTime(item.inQueueSince)}>
                      Waiting {timeAgo(item.inQueueSince)}
                    </span>
                  </div>
                </div>

                {/* Cancel button */}
                <button
                  onClick={() => handleCancel(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
