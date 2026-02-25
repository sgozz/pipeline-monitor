import { useState, useCallback } from 'react'
import { CheckCircle, XCircle, Loader2, MessageSquare, AlertTriangle } from 'lucide-react'

interface Props {
  fullname: string
  buildNumber: number
  input: JenkinsPendingInput
  onDone: () => void
  onCancel: () => void
}

export default function InputDialog({ fullname, buildNumber, input, onDone, onCancel }: Props) {
  const [params, setParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (input.parameters) {
      for (const p of input.parameters) {
        initial[p.name] = p.defaultValue || ''
      }
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)
  const [aborting, setAborting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const hasParams = input.parameters && input.parameters.length > 0
      await window.api.jenkins.submitInput(
        fullname,
        buildNumber,
        input.id,
        hasParams ? params : undefined
      )
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit input')
    } finally {
      setSubmitting(false)
    }
  }, [fullname, buildNumber, input, params, onDone])

  const handleAbort = useCallback(async () => {
    setAborting(true)
    setError(null)
    try {
      await window.api.jenkins.abortInput(fullname, buildNumber, input.id)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort input')
    } finally {
      setAborting(false)
    }
  }, [fullname, buildNumber, input, onDone])

  const busy = submitting || aborting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-amber-500/5">
          <MessageSquare size={16} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Pipeline Input Required</h2>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {/* Message */}
          <p className="text-sm text-slate-300">{input.message}</p>

          {/* Parameters */}
          {input.parameters && input.parameters.length > 0 && (
            <div className="space-y-3">
              {input.parameters.map((param) => (
                <div key={param.name}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {param.name}
                    {param.description && (
                      <span className="ml-1 font-normal text-slate-500">
                        — {param.description}
                      </span>
                    )}
                  </label>
                  {param.choices && param.choices.length > 0 ? (
                    <select
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                      disabled={busy}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      {param.choices.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  ) : param.type === 'BooleanParameterDefinition' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={params[param.name] === 'true'}
                        onChange={(e) =>
                          setParams((prev) => ({
                            ...prev,
                            [param.name]: e.target.checked ? 'true' : 'false'
                          }))
                        }
                        disabled={busy}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span className="text-sm text-slate-300">{param.name}</span>
                    </div>
                  ) : param.type === 'TextParameterDefinition' ? (
                    <textarea
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                      disabled={busy}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={params[param.name] || ''}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                      disabled={busy}
                      placeholder={param.defaultValue || ''}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAbort}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30 transition disabled:opacity-50"
          >
            {aborting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <XCircle size={12} />
            )}
            Abort
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle size={12} />
            )}
            {input.proceedText || 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}
