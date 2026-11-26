import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LiveCommand, LiveResult, LiveView } from '../../application/live/ports'
import type { LiveMatchManagement } from '../../application/live/service'
import type { Match } from '../../domain/match/contracts'
import { LiveMatchBoard } from './LiveMatchBoard'

export function LiveMatchWorkspace({ match, ownName, management, children }: {
  match: Match
  ownName: string
  management: LiveMatchManagement
  children: ReactNode
}) {
  const [view, setView] = useState<LiveView | null>(null)
  const [readFailed, setReadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const id = match.id

  function show(next: LiveView) {
    setView((current) => !current || next.match.version >= current.match.version ? next : current)
  }

  useEffect(() => management.observe(id, (next) => {
    show(next)
    setReadFailed(false)
  }, () => setReadFailed(true)), [management, id, attempt])

  async function dispatch(command: LiveCommand): Promise<LiveResult> {
    if (!view || pending.current || readFailed) return { ok: false, message: 'Espera a que termine el guardado.' }
    pending.current = true
    setBusy(true)
    setMessage('')
    try {
      const result = await management.dispatch(view.match, command)
      if (result.view) show(result.view)
      if (!result.ok) setMessage(result.message)
      return result
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  if (readFailed) return <section className="notice">
    <p role="alert">No se pudo leer el historial de este partido en el dispositivo.</p>
    <button type="button" className="button secondary" onClick={() => {
      setReadFailed(false)
      setView(null)
      setAttempt((value) => value + 1)
    }}>Reintentar</button>
  </section>
  if (!view) return <p role="status">Cargando partido…</p>
  if (view.status === 'started') {
    return <LiveMatchBoard view={view} ownName={ownName} busy={busy} message={message} dispatch={dispatch} />
  }
  return <>
    {view.status === 'ready' && <p className="form-actions">
      <button type="button" className="button" disabled={busy} onClick={() => void dispatch({ type: 'begin_match' })}>Iniciar anotación</button>
    </p>}
    {message && <p role="alert" className="form-error">{message}</p>}
    {children}
  </>
}
