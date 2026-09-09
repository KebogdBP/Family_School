import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { getProgressReport, getReviewQuestionSettings, saveReviewQuestionSettings } from '@/entities/planning/api'
import { getStudents } from '@/entities/student/api'

const feelingLabels: Record<string, string> = { easy: 'Было легко', good: 'Получилось', hard: 'Было трудно', need_help: 'Нужна помощь' }
const statusLabels = { assigned: 'Назначено', in_progress: 'В работе', submitted: 'Отправлено', needs_revision: 'Нужна доработка', reviewed: 'Проверено' }
const masteryLabels = { available: 'Ещё нет данных', learning: 'Изучается', needs_reinforcement: 'Нужно закрепить', mastered: 'Освоено' }
const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))

function ReviewQuestionEditor({ studentId, topicId }: { studentId: string; topicId: string }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null)
  const settings = useQuery({ queryKey: ['review-question-settings', studentId, topicId], queryFn: () => getReviewQuestionSettings(studentId, topicId), enabled: open })
  const selected = selectedOverride ?? settings.data?.selectedQuestionIds ?? []
  const save = useMutation({ mutationFn: () => saveReviewQuestionSettings(studentId, topicId, selected), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['review-question-settings', studentId, topicId] }) } })
  const toggle = (id: string) => setSelectedOverride(selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < 3 ? [...selected, id] : selected)
  return <div className="review-question-editor"><button className="button-secondary button-small" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Скрыть вопросы' : 'Настроить повторение'}</button>
    {open && <div className="review-question-panel"><p className="muted">Выберите 1–3 вопроса. Порядок выбора станет порядком контрольной.</p>
      {settings.isLoading ? <p>Загружаем вопросы…</p> : settings.data?.questions.length ? <>{settings.data.mode === 'automatic' && <span className="badge">Сейчас выбраны автоматически</span>}<div className="review-question-list">{settings.data.questions.map((question) => <label className="review-question-option" key={question.id}><input type="checkbox" checked={selected.includes(question.id)} disabled={!selected.includes(question.id) && selected.length >= 3} onChange={() => toggle(question.id)} /><span><strong>{question.prompt}</strong><small>{question.lessonTitle} · {question.title}</small></span></label>)}</div><button type="button" disabled={save.isPending || selected.length === 0} onClick={() => save.mutate()}>{save.isPending ? 'Сохраняем…' : `Сохранить (${selected.length})`}</button></> : <p className="muted">Сначала добавьте тестовые вопросы в уроки этой темы.</p>}
      {(settings.error || save.error) && <p className="form-error" role="alert">{(settings.error ?? save.error)?.message}</p>}{save.isSuccess && <p className="form-success" role="status">Набор вопросов сохранён.</p>}
    </div>}
  </div>
}

export function ProgressReportPage() {
  const { studentId = '' } = useParams()
  const report = useQuery({ queryKey: ['progress-report', studentId], queryFn: () => getProgressReport(studentId), enabled: Boolean(studentId) })
  const students = useQuery({ queryKey: ['students'], queryFn: getStudents })
  const student = students.data?.students.find((item) => item.id === studentId)
  const summary = report.data?.summary
  return <><header className="page-header"><p className="eyebrow">Учебный прогресс</p><div className="header-row"><div><h1>{student ? `Отчёт: ${student.displayName}` : 'Отчёт ученика'}</h1><p className="muted">Факты работы и обратная связь ребёнка без сравнения с другими.</p></div><NavLink className="button-link button-ghost" to="/children">← К ученикам</NavLink></div></header>
    {report.error && <p className="form-error">{report.error.message}</p>}{summary && <section className="report-summary"><article className="card"><strong>{summary.total}</strong><span>Назначено</span></article><article className="card"><strong>{summary.completed}</strong><span>Завершено</span></article><article className="card"><strong>{summary.masteredTopics}</strong><span>Тем освоено</span></article><article className={`card ${summary.topicsToReview ? 'help-summary' : ''}`}><strong>{summary.topicsToReview}</strong><span>Закрепить</span></article><article className="card"><strong>{summary.achievements}</strong><span>Достижения</span></article></section>}
    {report.data?.masterySubjects.length ? <section className="subject-progress">{report.data.masterySubjects.map((subject) => <article className="card subject-progress-card" key={subject.id} style={{ borderTopColor: subject.color }}><div className="lesson-card-heading"><h2>{subject.title}</h2><strong>{subject.score}%</strong></div><div className="progress-track"><div style={{ width: `${subject.score}%`, background: subject.color }} /></div><p className="muted">Освоено {subject.masteredCount} из {subject.topicCount} тем{subject.reviewCount ? ` · закрепить ${subject.reviewCount}` : ''}</p></article>)}</section> : null}
    {report.data?.achievements.length ? <section className="achievement-summary"><h2>Достижения</h2><div className="achievements">{report.data.achievements.map((achievement) => <article className="card achievement-card" key={achievement.id}><span className="achievement-medal" aria-hidden="true">🏅</span><div><strong>{achievement.title}</strong><p>{achievement.description}</p></div></article>)}</div></section> : null}
    {report.data?.mastery.length ? <section className="mastery-section"><div><h2>Освоение тем</h2><p className="muted">Статус основан на сохранённых тестах и проверенных домашних работах.</p></div><div className="mastery-grid">{report.data.mastery.map((topic) => <article className={`card mastery-card mastery-${topic.status}`} key={topic.id} style={{ borderTopColor: topic.subjectColor }}><div className="lesson-card-heading"><span className="badge">{topic.subjectTitle}</span><span className="lesson-status">{masteryLabels[topic.status]}</span></div><h3>{topic.title}</h3><p className="muted">{topic.sectionTitle}</p><div className="progress-track"><div style={{ width: `${topic.score}%`, background: topic.subjectColor }} /></div><small>{topic.evidenceCount ? `${topic.successfulCount} успешных подтверждений из ${topic.evidenceCount}` : 'Выполните тест или домашнюю работу'}</small>{topic.nextReviewAt && <p className="review-date">Повторить {date(topic.nextReviewAt)}</p>}{topic.evidence.length > 0 && <details><summary>Почему такой статус</summary><ul>{topic.evidence.slice(0, 5).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></details>}<ReviewQuestionEditor studentId={studentId} topicId={topic.id} /></article>)}</div></section> : null}
    {report.isLoading ? <p>Собираем отчёт…</p> : report.data?.items.length ? <section className="report-list">{report.data.items.map((item) => <article className="card report-row" key={item.id} style={{ borderLeftColor: item.subjectColor }}><div><span className="badge">{item.subjectTitle}</span><h2>{item.title}</h2><p className="muted">{date(item.scheduledDate)} · {item.isRequired ? 'обязательно' : 'дополнительно'}</p></div><span className={`lesson-status status-${item.planStatus}`}>{statusLabels[item.planStatus]}</span>{item.reflection && <div className={`reflection-result ${item.reflection.feeling === 'need_help' ? 'needs-help' : ''}`}><strong>{feelingLabels[item.reflection.feeling]}</strong>{item.reflection.comment && <p>{item.reflection.comment}</p>}</div>}</article>)}</section> : <section className="card empty"><h2>Данных пока нет</h2><p className="muted">Назначьте первый урок в недельном плане.</p></section>}
  </>
}
