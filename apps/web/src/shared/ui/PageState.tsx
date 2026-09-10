import { Component, type ErrorInfo, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export function LoadingState({ label = 'Загружаем данные…' }: { label?: string }) {
  return (
    <section className="page-state loading-state" role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <p>{label}</p>
    </section>
  )
}

export function ErrorState({
  error,
  onRetry,
  fullPage = false,
}: {
  error: unknown
  onRetry?: () => void
  fullPage?: boolean
}) {
  const message = error instanceof Error ? error.message : 'Не удалось загрузить данные'
  return (
    <section className={`card page-state error-state${fullPage ? ' full-page-state' : ''}`} role="alert">
      <span className="state-icon" aria-hidden="true">
        !
      </span>
      <div>
        <h1>Что-то пошло не так</h1>
        <p>{message}</p>
        <p className="muted">
          Проверьте соединение и попробуйте ещё раз. Введённые данные в формах не отправляйте повторно, если не уверены
          в результате.
        </p>
        {onRetry && <button onClick={onRetry}>Повторить</button>}
      </div>
    </section>
  )
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className="card empty page-state">
      <span className="state-icon state-icon-calm" aria-hidden="true">
        ✓
      </span>
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        {children}
      </div>
    </section>
  )
}

export function NotFoundState({ home }: { home: string }) {
  return (
    <section className="card page-state not-found-state">
      <span className="state-code">404</span>
      <div>
        <h1>Такой страницы нет</h1>
        <p className="muted">Возможно, ссылка устарела или адрес был введён с ошибкой.</p>
        <NavLink className="button-link" to={home}>
          Вернуться в кабинет
        </NavLink>
      </div>
    </section>
  )
}

type BoundaryState = { error: Error | null }
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected application error', error, info.componentStack)
  }
  render() {
    if (this.state.error)
      return (
        <main>
          <ErrorState fullPage error={this.state.error} onRetry={() => window.location.reload()} />
        </main>
      )
    return this.props.children
  }
}
