import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { MembershipManagement } from '../../application/memberships/service'
import type { SaveResult } from '../../application/shared/save-result'
import type { MembershipDirectory } from '../../application/memberships/ports'
import { demoAthletes, demoClub, demoMemberships, demoSeason, demoTeams, demoTeamSeasons } from '../../demo/data'
import { MembershipForm } from './MembershipForm'

const directory: MembershipDirectory = { club: demoClub, athletes: demoAthletes, teams: demoTeams, seasons: [demoSeason], teamSeasons: demoTeamSeasons, memberships: [] }
const context = { team: demoTeams[0]!, season: demoSeason, teamSeason: demoTeamSeasons[0]! }
const base: MembershipManagement = { observe: () => () => {}, save: async () => ({ ok: true }), setActive: async () => ({ ok: true }) }

describe('selección e inscripción de perfiles existentes', () => {
  it('solo ofrece perfiles activos sin inscripción previa en esa plantilla, incluso si fue archivada', () => {
    const entries = [{ ...demoMemberships[0]!, active: false }]
    const athletes = demoAthletes.map((athlete) => ({ ...athlete, active: athlete.id !== 'demo-sol' }))
    render(<MemoryRouter><MembershipForm current={null} context={context} directory={{ ...directory, memberships: entries, athletes }} management={base} onSaved={() => {}} onCancel={() => {}} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Alex Marín/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sol Ríos/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Noa Vega/ })).toBeVisible()
    expect(screen.queryByLabelText('Nombre del deportista')).not.toBeInTheDocument()
  })

  it('conserva selección, dorsal y rol después de un fallo de guardado', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, message: 'No se pudo guardar.' })
    render(<MemoryRouter><MembershipForm current={null} context={context} directory={directory} management={{ ...base, save }} onSaved={() => {}} onCancel={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Alex Marín/ }))
    fireEvent.change(screen.getByLabelText('Dorsal'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Rol habitual'), { target: { value: 'central' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar.')
    expect(screen.getByRole('button', { name: /Alex Marín/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Dorsal')).toHaveValue('5')
    expect(screen.getByLabelText('Rol habitual')).toHaveValue('central')
  })

  it('bloquea el doble envío de una misma inscripción pendiente', async () => {
    let complete!: (result: SaveResult) => void
    const save = vi.fn(() => new Promise<SaveResult>((resolve) => { complete = resolve }))
    const onSaved = vi.fn()
    render(<MemoryRouter><MembershipForm current={null} context={context} directory={directory} management={{ ...base, save }} onSaved={onSaved} onCancel={() => {}} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Alex Marín/ }))
    const form = screen.getByRole('form', { name: 'Inscribir deportista' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    complete({ ok: true })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })
})
