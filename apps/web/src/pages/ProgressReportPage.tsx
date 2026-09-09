import { useQuery } from '@tanstack/react-query'
import { NavLink, useParams } from 'react-router-dom'
import { getProgressReport } from '@/entities/planning/api'
import { getStudents } from '@/entities/student/api'

const feelingLabels: Record<string, string> = { easy: 'Было легко', good: 'Получилось', hard: 'Было трудно', need_help: 'Нужна помощь' }
const statusLabels = { not_started: 'Не открыт', in_progress: 'В процессе', completed: 'Завершён' }
const date = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))

export function ProgressReportPage() {
  const { studentId = '' } = useParams()
  const report = useQuery({ queryKey: ['progress-report', studentId], queryFn: () => getProgressReport(studentId), enabled: Boolean(studentId) })
  const students = useQuery({ queryKey: ['students'], queryFn: getStudents })
  const student = students.data?.students.find((item) => item.id === studentId)
  const summary = report.data?.summary
  return <><header className="page-header"><p className="eyebrow">Учебный прогресс</p><div className="header-row"><div><h1>{student ? `Отчёт: ${student.displayName}` : 'Отчёт ученика'}</h1><p className="muted">Факты работы и обратная связь ребёнка без сравнения с другими.</p></div><NavLink className="button-link button-ghost" to="/children">← К ученикам</NavLink></div></header>
    {report.error && <p className="form-error">{report.error.message}</p>}{summary && <section className="report-summary"><article className="card"><strong>{summary.total}</strong><span>Назначено</span></article><article className="card"><strong>{summary.completed}</strong><span>Завершено</span></article><article className="card"><strong>{summary.inProgress}</strong><span>В процессе</span></article><article className={`card ${summary.needsHelp ? 'help-summary' : ''}`}><strong>{summary.needsHelp}</strong><span>Нужна помощь</span></article></section>}
    {report.isLoading ? <p>Собираем отчёт…</p> : report.data?.items.length ? <section className="report-list">{report.data.items.map((item) => <article className="card report-row" key={item.id} style={{ borderLeftColor: item.subjectColor }}><div><span className="badge">{item.subjectTitle}</span><h2>{item.title}</h2><p className="muted">{date(item.scheduledDate)} · {item.isRequired ? 'обязательно' : 'дополнительно'}</p></div><span className={`lesson-status status-${item.progressStatus}`}>{statusLabels[item.progressStatus]}</span>{item.reflection && <div className={`reflection-result ${item.reflection.feeling === 'need_help' ? 'needs-help' : ''}`}><strong>{feelingLabels[item.reflection.feeling]}</strong>{item.reflection.comment && <p>{item.reflection.comment}</p>}</div>}</article>)}</section> : <section className="card empty"><h2>Данных пока нет</h2><p className="muted">Назначьте первый урок в недельном плане.</p></section>}
  </>
}
