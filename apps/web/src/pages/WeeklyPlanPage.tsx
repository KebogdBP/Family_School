import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { addPlanItem, deletePlanItem, getWeeklyPlan, type PlanItem } from '@/entities/planning/api'
import { getStudents } from '@/entities/student/api'

const today = () => new Date().toISOString().slice(0, 10)
const monday = (date: string) => { const value = new Date(`${date}T12:00:00`); const day = value.getDay() || 7; value.setDate(value.getDate() - day + 1); return value.toISOString().slice(0, 10) }
const shiftWeek = (date: string, days: number) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10) }
const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
const statusLabels = { assigned: 'Назначено', in_progress: 'В работе', submitted: 'Отправлено', needs_revision: 'Нужна доработка', reviewed: 'Проверено' }

function Item({ item, refresh }: { item: PlanItem; refresh: () => Promise<unknown> }) {
  const remove = useMutation({ mutationFn: () => deletePlanItem(item.id), onSuccess: refresh })
  return <article className="plan-item" style={{ borderLeftColor: item.subjectColor }}><div><strong>{item.title}</strong><small>{item.subjectTitle} · {item.isRequired ? 'обязательно' : 'дополнительно'}</small></div><span className={`lesson-status status-${item.planStatus}`}>{statusLabels[item.planStatus]}</span><button className="icon-button icon-danger" aria-label={`Удалить ${item.title}`} disabled={remove.isPending} onClick={() => remove.mutate()}>×</button></article>
}

export function WeeklyPlanPage() {
  const { studentId = '' } = useParams()
  const client = useQueryClient()
  const [week, setWeek] = useState(monday(today()))
  const [form, setForm] = useState({ lessonId: '', scheduledDate: today(), isRequired: true })
  const students = useQuery({ queryKey: ['students'], queryFn: getStudents })
  const plan = useQuery({ queryKey: ['weekly-plan', studentId, week], queryFn: () => getWeeklyPlan(studentId, week), enabled: Boolean(studentId) })
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['weekly-plan', studentId, week] }) }
  const add = useMutation({ mutationFn: () => addPlanItem(studentId, { ...form, position: plan.data?.items.filter((item) => item.scheduledDate === form.scheduledDate).length ?? 0 }), onSuccess: async () => { setForm((current) => ({ ...current, lessonId: '' })); await refresh() } })
  const student = students.data?.students.find((value) => value.id === studentId)
  const days = Array.from({ length: 7 }, (_, index) => shiftWeek(week, index))
  return <><header className="page-header"><p className="eyebrow">Недельный план</p><div className="header-row"><div><h1>{student ? `План: ${student.displayName}` : 'План ученика'}</h1><p className="muted">Назначьте обязательный минимум и дополнительные уроки.</p></div><NavLink className="button-link button-ghost" to="/children">← К ученикам</NavLink></div></header>
    <section className="card week-toolbar"><button className="button-ghost" onClick={() => setWeek(shiftWeek(week, -7))}>← Раньше</button><strong>{formatDate(week)} — {formatDate(shiftWeek(week, 6))}</strong><button className="button-ghost" onClick={() => setWeek(shiftWeek(week, 7))}>Позже →</button></section>
    <form className="card plan-form" onSubmit={(event) => { event.preventDefault(); add.mutate() }}><label className="field"><span>Урок</span><select required value={form.lessonId} onChange={(event) => setForm({ ...form, lessonId: event.target.value })}><option value="">Выберите урок</option>{plan.data?.availableLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.subjectTitle}: {lesson.title}</option>)}</select></label><label className="field"><span>Дата</span><input type="date" min={week} max={shiftWeek(week, 6)} required value={form.scheduledDate} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value })} /></label><label className="check-field"><input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} /><span>Обязательный урок</span></label><button disabled={add.isPending}>Добавить в план</button>{add.error && <p className="form-error">{add.error.message}</p>}</form>
    {plan.isLoading ? <p>Загружаем неделю…</p> : <section className="week-grid">{days.map((day) => <div className={`day-column ${day === today() ? 'today-column' : ''}`} key={day}><h2>{formatDate(day)}</h2><div>{plan.data?.items.filter((item) => item.scheduledDate === day).map((item) => <Item key={item.id} item={item} refresh={refresh} />)}{!plan.data?.items.some((item) => item.scheduledDate === day) && <p className="muted day-empty">Свободный день</p>}</div></div>)}</section>}
  </>
}
