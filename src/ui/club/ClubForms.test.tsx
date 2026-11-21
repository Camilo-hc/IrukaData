import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ClubManagement, SaveResult } from '../../application/club/service'
import { ClubForm, SeasonForm } from './ClubForms'

const base: ClubManagement = {
  observe: () => () => {}, saveClub: async () => ({ ok: true }), saveTeam: async () => ({ ok: true }),
  saveSeason: async () => ({ ok: true }), setTeamActive: async () => ({ ok: true }), setSeasonActive: async () => ({ ok: true }),
}

describe('formularios de gestión', () => {
  it('bloquea dos envíos mientras el primer guardado sigue pendiente', async () => {
    let complete!: (result: SaveResult) => void
    const saveClub = vi.fn(() => new Promise<SaveResult>((resolve) => { complete = resolve }))
    const onSaved = vi.fn()
    render(<ClubForm current={null} management={{ ...base, saveClub }} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Nombre del club'), { target: { value: 'Club Iruka' } })
    const form = screen.getByRole('form', { name: 'Configurar club' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(saveClub).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    complete({ ok: true })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('conserva los campos y permite reintentar tras un fallo de almacenamiento', async () => {
    const saveSeason = vi.fn().mockResolvedValue({ ok: false, message: 'No se pudo guardar.' })
    const onSaved = vi.fn()
    render(<SeasonForm current={null} management={{ ...base, saveSeason }} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Nombre de la temporada'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar.')
    expect(screen.getByLabelText('Nombre de la temporada')).toHaveValue('2026')
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2026-01-01')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
