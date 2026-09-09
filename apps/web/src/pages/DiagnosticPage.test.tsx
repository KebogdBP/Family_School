import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DiagnosticPage } from './DiagnosticPage'

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DiagnosticPage /></MemoryRouter></QueryClientProvider>)
}

describe('DiagnosticPage', () => {
  it('explains when the parent has not installed a pilot route', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ available: false, completed: false }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Диагностика пока недоступна' })).toBeInTheDocument()
    expect(screen.getByText(/попроси родителя/i)).toBeInTheDocument()
  })

  it('submits every answer and shows the recommended first lesson', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => json({ available: true, completed: false, routeTitle: 'Дроби: стартовая проверка', questions: [
        { id: 'first', prompt: 'Первый вопрос?', options: ['А', 'Б'] },
        { id: 'second', prompt: 'Второй вопрос?', options: ['В', 'Г'] },
      ], result: null }))
      .mockImplementationOnce(() => json({ completed: true, result: { score: 50, recommendedTopicId: 'topic-1', recommendedTopicTitle: 'Дробь как часть целого', recommendedLessonId: 'lesson-1', recommendedLessonTitle: 'Доля и целое', completedAt: '2026-09-10 10:00:00' } }, 201))
      .mockImplementationOnce(() => json({ available: true, completed: true, questions: [], result: null }))

    renderPage()
    fireEvent.click(await screen.findByLabelText('А'))
    fireEvent.click(screen.getByLabelText('Г'))
    fireEvent.click(screen.getByRole('button', { name: 'Завершить диагностику' }))

    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Дробь как часть целого' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /перейти к уроку/i })).toHaveAttribute('href', '/study/lessons/lesson-1')
    const requestInit=fetchMock.mock.calls[1]?.[1]
    expect(typeof requestInit?.body).toBe('string')
    expect(JSON.parse(requestInit?.body as string) as unknown).toEqual({ answers: [0, 1] })
  })

  it('shows a previously saved result without offering a second attempt', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ available: true, completed: true, routeTitle: 'Обыкновенные дроби: стартовая проверка', questions: [], result: { score: 100, recommendedTopicId: 'topic-4', recommendedTopicTitle: 'Задачи и объяснение', recommendedLessonId: 'lesson-8', recommendedLessonTitle: 'Маршрут решения задачи', completedAt: '2026-09-10 10:00:00' } }))
    renderPage()
    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Задачи и объяснение' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Завершить диагностику' })).not.toBeInTheDocument()
  })
})
