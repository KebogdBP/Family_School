import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { getStudentMastery, getStudentReviewTasks } from '@/entities/learning/api'

const labels = { available: 'Впереди', learning: 'Изучаю', needs_reinforcement: 'Закрепить', mastered: 'Освоено' }
const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`))

export function StudentProgressPage() {
  const query = useQuery({ queryKey: ['student-mastery'], queryFn: getStudentMastery })
  const reviews = useQuery({ queryKey: ['student-reviews'], queryFn: getStudentReviewTasks })
  return <><header className="page-header"><p className="eyebrow">Личный рост</p><h1>Мой прогресс</h1><p className="muted">Твои предметы и темы — без сравнения с кем-либо.</p></header>{(query.error || reviews.error) && <p className="form-error">{query.error?.message ?? reviews.error?.message}</p>}
    {reviews.data?.reviewTasks.length ? <section className="upcoming-reviews"><h2>Повторения</h2>{reviews.data.reviewTasks.map((task) => <article className={`card review-task ${task.isDue ? 'review-task-due' : ''}`} key={task.id} style={{ borderLeftColor: task.subjectColor }}><div><span className="badge">{task.isDue ? 'Пора повторить' : `Запланировано на ${date(task.dueDate)}`}</span><h3>{task.topicTitle}</h3><p>{task.reason}</p></div>{task.isDue ? <NavLink className="button-link" to={`/reviews/${task.id}`}>Начать контрольную →</NavLink> : task.lessonId ? <NavLink className="button-link button-ghost" to={`/study/lessons/${task.lessonId}`}>Открыть тему →</NavLink> : null}</article>)}</section> : null}
    {query.isLoading ? <p>Собираем прогресс…</p> : <><section className="subject-progress">{query.data?.subjects.map((subject) => <article className="card subject-progress-card" key={subject.id} style={{ borderTopColor: subject.color }}><div className="lesson-card-heading"><h2>{subject.title}</h2><strong>{subject.score}%</strong></div><div className="progress-track"><div style={{ width: `${subject.score}%`, background: subject.color }} /></div><p className="muted">Освоено тем: {subject.masteredCount} из {subject.topicCount}{subject.reviewCount ? ` · закрепить: ${subject.reviewCount}` : ''}</p></article>)}</section><section className="mastery-grid">{query.data?.topics.map((topic) => <article className={`card mastery-card mastery-${topic.status}`} key={topic.id} style={{ borderTopColor: topic.subjectColor }}><div className="lesson-card-heading"><span className="badge">{topic.subjectTitle}</span><span className="lesson-status">{labels[topic.status]}</span></div><h3>{topic.title}</h3><div className="progress-track"><div style={{ width: `${topic.score}%`, background: topic.subjectColor }} /></div><small>{topic.evidenceCount ? `${topic.successfulCount} успешных подтверждений из ${topic.evidenceCount}` : 'Результатов пока нет'}</small></article>)}</section></>}
  </>
}
