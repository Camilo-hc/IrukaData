import { useEffect, useState, type ChangeEvent } from 'react'
import { BACKUP_COUNTS, type BackupManagement, type BackupPreview } from '../../application/backup/service'
import { downloadText } from '../shared/download'

const dateTime = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

export function BackupPage({ management }: { management: BackupManagement }) {
  const [lastExport, setLastExport] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ file: string; value: BackupPreview } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [persistent, setPersistent] = useState<boolean | null>(null)
  const [storageNotice, setStorageNotice] = useState('')
  const canRequestPersistence = typeof navigator.storage?.persist === 'function'

  useEffect(() => {
    let active = true
    void management.lastExport().then((value) => { if (active) setLastExport(value) }, () => {})
    if (navigator.storage?.persisted) {
      void navigator.storage.persisted().then((value) => { if (active) setPersistent(value) }, () => {})
    }
    return () => { active = false }
  }, [management])

  async function exportBackup() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await management.exportBackup()
      downloadText(data.filename, data.text, 'application/json')
      setLastExport(data.exportedAt)
      setNotice('Respaldo generado. Conserva el archivo descargado.')
      await management.markExported(data.exportedAt)
    } catch {
      setError('No se pudo completar la exportación del respaldo.')
    } finally { setBusy(false) }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusy(true)
    setConfirmed(false)
    setPreview(null)
    setError('')
    setNotice('')
    try {
      setPreview({ file: file.name, value: await management.preview(await file.text()) })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo leer el archivo.')
    } finally { setBusy(false) }
  }

  async function restoreBackup() {
    if (!preview || !confirmed || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await preview.value.restore()
      if (result === 'restored') {
        setPreview(null)
        setConfirmed(false)
        setNotice('Respaldo restaurado. Tus datos ya están disponibles.')
      } else if (result === 'changed') {
        setPreview(null)
        setConfirmed(false)
        setError('Los datos locales cambiaron desde la vista previa. Selecciona el archivo de nuevo para revisar el estado actual.')
      } else setError('No se pudo restaurar el respaldo. Se conservaron los datos locales.')
    } finally { setBusy(false) }
  }

  async function requestPersistence() {
    if (!canRequestPersistence) return
    setStorageNotice('')
    try {
      const granted = await navigator.storage.persist()
      setPersistent(granted)
      setStorageNotice(granted ? 'El navegador activó el almacenamiento persistente.' : 'El navegador no concedió almacenamiento persistente.')
    } catch { setStorageNotice('El navegador no pudo gestionar la solicitud de almacenamiento.') }
  }

  return <section className="club-page report-page">
    <div className="page-heading compact">
      <h1>Respaldos</h1>
      <p className="lead">Descarga o restaura una copia de los datos de tu club en este dispositivo.</p>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="live-panel" aria-labelledby="backup-export">
      <h2 id="backup-export">Exportar respaldo</h2>
      <p>{lastExport ? 'Último respaldo generado en este navegador: ' + dateTime.format(new Date(lastExport)) : 'Todavía no se ha generado un respaldo en este navegador.'}</p>
      <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => void exportBackup()}>Descargar respaldo JSON</button></div>
    </section>
    <section className="live-panel" aria-labelledby="backup-import">
      <h2 id="backup-import">Restaurar respaldo</h2>
      <div className="field">
        <label htmlFor="backup-file">Archivo de respaldo JSON</label>
        <input type="file" id="backup-file" accept=".json,application/json" disabled={busy} onChange={(event) => void readFile(event)} />
      </div>
      {preview && <div className="backup-preview">
        <h3>Vista previa de restauración</h3>
        <p>{preview.file} · {dateTime.format(new Date(preview.value.exportedAt))}</p>
        <div className="table-scroll"><table>
          <caption className="sr-only">Comparación del respaldo con los datos locales</caption>
          <thead><tr><th scope="col">Registro</th><th scope="col">Datos actuales</th><th scope="col">Respaldo</th></tr></thead>
          <tbody>
            <tr><th scope="row">Club</th><td>{preview.value.current.club ?? '—'}</td><td>{preview.value.incoming.club ?? '—'}</td></tr>
            {BACKUP_COUNTS.map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td>{preview.value.current[key]}</td><td>{preview.value.incoming[key]}</td></tr>)}
          </tbody>
        </table></div>
        <label className="checkbox-label">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />
          Confirmo que quiero reemplazar los datos locales con este respaldo.
        </label>
        <div className="form-actions">
          <button type="button" className="button" disabled={!confirmed || busy} onClick={() => void restoreBackup()}>Restaurar datos</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false) }}>Cancelar restauración</button>
        </div>
      </div>}
      {busy && <p role="status">Procesando respaldo…</p>}
    </section>
    <section className="live-panel" aria-labelledby="backup-storage">
      <h2 id="backup-storage">Almacenamiento en este dispositivo</h2>
      <p>Borrar los datos del sitio puede eliminar el historial. El respaldo JSON se conserva como un archivo separado.</p>
      {persistent && <p>Almacenamiento persistente activo.</p>}
      {canRequestPersistence && !persistent && <div className="form-actions"><button type="button" className="button secondary" onClick={() => void requestPersistence()}>Solicitar almacenamiento persistente</button></div>}
      {storageNotice && <p role="status">{storageNotice}</p>}
    </section>
  </section>
}
