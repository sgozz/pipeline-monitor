import { useState, useEffect, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import InputDialog from './InputDialog'

interface Props {
  fullname: string
  buildNumber: number
}

export default function PendingInputInline({ fullname, buildNumber }: Props) {
  const [inputs, setInputs] = useState<JenkinsPendingInput[]>([])
  const [activeInput, setActiveInput] = useState<JenkinsPendingInput | null>(null)

  const fetchInputs = useCallback(async () => {
    try {
      const data = await window.api.jenkins.getPendingInputs(fullname, buildNumber)
      setInputs(data)
    } catch {
      setInputs([])
    }
  }, [fullname, buildNumber])

  useEffect(() => {
    fetchInputs()
    // Poll every 15s to detect new inputs
    const timer = setInterval(fetchInputs, 15_000)
    return () => clearInterval(timer)
  }, [fetchInputs])

  const handleDone = useCallback(() => {
    setActiveInput(null)
    setInputs([])
    // Re-fetch after a brief delay to let Jenkins process the action
    setTimeout(fetchInputs, 2000)
  }, [fetchInputs])

  if (inputs.length === 0) return null

  return (
    <>
      <div className="px-8 py-1.5">
        {inputs.map((input) => (
          <div
            key={input.id}
            className="flex items-center gap-2 px-3 py-2 rounded border border-amber-500/30 bg-amber-500/10 mb-1"
          >
            <MessageSquare size={12} className="text-amber-400 shrink-0 animate-pulse" />
            <p className="flex-1 text-xs text-amber-200 truncate">{input.message}</p>
            <button
              onClick={() => setActiveInput(input)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition shrink-0"
            >
              Respond
            </button>
          </div>
        ))}
      </div>

      {activeInput && (
        <InputDialog
          fullname={fullname}
          buildNumber={buildNumber}
          input={activeInput}
          onDone={handleDone}
          onCancel={() => setActiveInput(null)}
        />
      )}
    </>
  )
}
