import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

describe('App', () => {
  it('shows parent login when there is no active session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Требуется вход' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Вход для родителя' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Забыли пароль?' })).toHaveAttribute('href', '/recover-password')
  })

  it('shows setup-token password recovery form', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Требуется вход' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/recover-password']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Восстановление пароля' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ключ установки')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Назначить новый пароль' })).toBeDisabled()
  })
})
