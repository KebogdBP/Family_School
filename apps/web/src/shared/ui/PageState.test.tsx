import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppErrorBoundary, EmptyState, ErrorState, NotFoundState } from './PageState'

describe('shared page states', () => {
  it('offers a retry for a loading error', () => {
    const retry = vi.fn()
    render(<ErrorState error={new Error('Сервер недоступен')} onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Сервер недоступен')
    screen.getByRole('button', { name: 'Повторить' }).click()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders useful empty and not-found actions', () => {
    render(<MemoryRouter><EmptyState title="План пуст" description="Добавьте первый урок." /><NotFoundState home="/today" /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'План пуст' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вернуться в кабинет' })).toHaveAttribute('href', '/today')
  })

  it('catches an unexpected rendering error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Broken = () => { throw new Error('Ошибка интерфейса') }
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка интерфейса')
    consoleError.mockRestore()
  })
})
