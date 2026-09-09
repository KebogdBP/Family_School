import { useQuery } from '@tanstack/react-query'
import { getStudentAchievements } from '@/entities/learning/api'

export function StudentAchievementsPage() {
  const query = useQuery({ queryKey: ['student-achievements'], queryFn: getStudentAchievements })
  return <><header className="page-header"><p className="eyebrow">Личный прогресс</p><h1>Мои достижения</h1><p className="muted">Здесь только твои результаты — без сравнения с другими.</p></header>{query.error && <p className="form-error">{query.error.message}</p>}{query.isLoading ? <p>Загружаем достижения…</p> : query.data?.achievements.length ? <section className="achievements">{query.data.achievements.map((achievement) => <article className="card achievement-card" key={achievement.id}><span className="achievement-medal" aria-hidden="true">🏅</span><div><span className="badge">Получено</span><h2>{achievement.title}</h2><p>{achievement.description}</p><small>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(achievement.earnedAt))}</small></div></article>)}</section> : <section className="card empty"><h2>Первое достижение впереди</h2><p className="muted">Доработай задание после комментария или подтверди тему на повторении.</p></section>}</>
}
