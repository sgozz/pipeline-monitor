import { useState, useEffect } from 'react'
import { Play, X, Loader2 } from 'lucide-react'

interface Props {
  fullname: string
  onBuild: (params: Record<string, string>) => void
  onCancel: () => void
}

export default function BuildParamsDialog({ fullname, onBuild, onCancel }: Props) {
  const [paramDefs, setParamDefs] = useState<JenkinsBuildParameterDef[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.jenkins.getBuildParameters(fullname).then((defs) => {
      setParamDefs(defs)
      const defaults: Record<string, string> = {}
      for (const d of defs) {
        defaults[d.name] = d.defaultValue ?? ''
      }
      setValues(defaults)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [fullname])

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 w-full max-w-md">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading parameters...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 w-full max-w-md max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Build Parameters</h3>
          <button onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-300 transition">
            <X size={16} />
          </button>
        </div>

        {paramDefs.length === 0 ? (
          <p className="text-xs text-slate-500 mb-4">No parameters defined for this job.</p>
        ) : (
          <div className="space-y-4 mb-4">
            {paramDefs.map((def) => (
              <div key={def.name}>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {def.name}
                  {def.description && (
                    <span className="ml-1 text-slate-600 font-normal">— {def.description}</span>
                  )}
                </label>
                {def.choices && def.choices.length > 0 ? (
                  <select
                    value={values[def.name] ?? ''}
                    onChange={(e) => handleChange(def.name, e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {def.choices.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : def.type?.includes('Boolean') ? (
                  <input
                    type="checkbox"
                    checked={values[def.name] === 'true'}
                    onChange={(e) => handleChange(def.name, e.target.checked ? 'true' : 'false')}
                    className="w-4 h-4 accent-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[def.name] ?? ''}
                    onChange={(e) => handleChange(def.name, e.target.value)}
                    placeholder={def.defaultValue || ''}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onBuild(values)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-500 transition"
          >
            <Play size={12} />
            Build
          </button>
        </div>
      </div>
    </div>
  )
}
