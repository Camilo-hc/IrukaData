import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { StorageHealthPort } from '../application/ports'

const available: StorageHealthPort = { check: async () => 'ready' }

describe('pantalla inicial', () => {
  it('muestra el alcance y permite consultar la demostración', async () => {
    render(<MemoryRouter><App storageHealth={available} /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Todo comienza')
    expect(await screen.findByRole('status')).toHaveTextContent('Almacenamiento local disponible')
    fireEvent.click(screen.getByRole('link', { name: 'Explorar datos de ejemplo' }))
    expect(screen.getByRole('heading', { name: 'Equipos de ejemplo' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'Alex Marín' })).toHaveLength(2)
    expect(screen.getByText('#5')).toBeVisible()
    expect(screen.getByText('#8')).toBeVisible()
  })

  it('explica que no podrá guardar si IndexedDB no está disponible', async () => {
    render(<MemoryRouter><App storageHealth={{ check: async () => 'unavailable' }} /></MemoryRouter>)
    expect(await screen.findByText(/No se pueden guardar datos/)).toBeVisible()
  })

  it('ofrece volver al inicio desde una ruta desconocida', async () => {
    render(<MemoryRouter initialEntries={['/inexistente']}><App storageHealth={available} /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
    expect(await screen.findByRole('status')).toHaveTextContent('Almacenamiento local disponible')
  })
})
