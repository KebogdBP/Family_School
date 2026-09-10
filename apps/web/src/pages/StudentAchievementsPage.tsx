import { useQuery } from '@tanstack/react-query'
import { getStudentAchievements } from '@/entities/learning/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/PageState'

export function StudentAchievementsPage() {
  const query = useQuery({ queryKey: ['student-achievements'], queryFn: getStudentAchievements })
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Личный прогресс</p>
        <h1>Мои достижения</h1>
        <p className="muted">Здесь только твои результаты — без сравнения с другими.</p>
      </header>
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <LoadingState label="Загружаем достижения…" />
      ) : query.data?.achievements.length ? (
        <section className="achievements">
          {query.data.achievements.map((achievement) => (
            <article className="card achievement-card" key={achievement.id}>
              <span className="achievement-medal" aria-hidden="true">
                🏅
              </span>
              <div>
                <span className="badge">Получено</span>
                <h2>{achievement.title}</h2>
                <p>{achievement.description}</p>
                <small>
                  {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
                    new Date(achievement.earnedAt),
                  )}
                </small>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Первое достижение впереди"
          description="Доработай задание после комментария или подтверди тему на повторении."
        />
      )}
    </>
  )
}
