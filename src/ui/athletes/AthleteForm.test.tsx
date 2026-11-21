import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AthleteManagement } from '../../application/athletes/service'
import type { SaveResult } from '../../application/shared/save-result'
import type { Athlete } from '../../domain/club/contracts'
import type { Id } from '../../domain/shared/types'
import { AthleteForm } from './AthleteForm'

const base: AthleteManagement = { observe: () => () => {}, save: async () => ({ ok: true }), setActive: async () => ({ ok: true }) }

describe('formulario de deportista', () => {
  it('bloquea el doble envío y enfoca el nombre al abrir', async () => {
    let complete!: (result: SaveResult) => void
    const save = vi.fn(() => new Promise<SaveResult>((resolve) => { complete = resolve }))
    const onSaved = vi.fn()
    render(<AthleteForm current={null} athletes={[]} management={{ ...base, save }} onSaved={onSaved} onCancel={() => {}} />)
    expect(screen.getByLabelText('Nombre del deportista')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Nombre del deportista'), { target: { value: 'Álex Marín' } })
    const form = screen.getByRole('form', { name: 'Nuevo deportista' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    complete({ ok: true })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('conserva nombre, nacimiento y notas cuando falla el guardado', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, message: 'Almacenamiento no disponible.' })
    render(<AthleteForm current={null} athletes={[]} management={{ ...base, save }} onSaved={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nombre del deportista'), { target: { value: 'María Ríos' } })
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento (opcional)'), { target: { value: '2008-02-29' } })
    fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Primera línea\nSegunda línea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Almacenamiento no disponible.')
    expect(screen.getByLabelText('Nombre del deportista')).toHaveValue('María Ríos')
    expect(screen.getByLabelText('Fecha de nacimiento (opcional)')).toHaveValue('2008-02-29')
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Primera línea\nSegunda línea')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('avisa de homónimos, incluidos los archivados, sin impedir crear otra persona', () => {
    const existing: Athlete = { id: 'existing' as Id<'Athlete'>, name: 'María Ríos', active: false, revision: 1 }
    render(<AthleteForm current={null} athletes={[existing]} management={base} onSaved={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nombre del deportista'), { target: { value: 'Maria Rios' } })
    expect(screen.getByRole('complementary', { name: 'Perfiles con el mismo nombre' })).toHaveTextContent('Archivado')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('no trata una fecha parcialmente escrita como si el usuario la hubiera dejado vacía', () => {
    const save = vi.fn()
    render(<AthleteForm current={null} athletes={[]} management={{ ...base, save }} onSaved={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nombre del deportista'), { target: { value: 'Sol Vega' } })
    const dateInput = screen.getByLabelText('Fecha de nacimiento (opcional)')
    Object.defineProperty(dateInput, 'validity', { configurable: true, value: { badInput: true } })
    fireEvent.submit(screen.getByRole('form', { name: 'Nuevo deportista' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Completa una fecha válida')
    expect(dateInput).toHaveAttribute('aria-invalid', 'true')
    expect(dateInput).toHaveFocus()
    expect(save).not.toHaveBeenCalled()
  })
})
