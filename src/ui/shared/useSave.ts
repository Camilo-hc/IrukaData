import { useRef, useState } from 'react'
import type { SaveResult } from '../../application/shared/save-result'

export function useSave(onSaved: (message: string) => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SaveResult | null>(null)

  async function run(operation: () => Promise<SaveResult>, message: string) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setResult(null)
    try {
      const response = await operation()
      setResult(response)
      if (response.ok) onSaved(message)
    } catch {
      setResult({ ok: false, message: 'No se pudo completar el guardado. Conserva el formulario y vuelve a intentarlo.' })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, result, run, clearResult: () => setResult(null) }
}
