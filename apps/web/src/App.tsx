import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { exportFamilyData, getMe, loginParent, loginStudent, logout, setupFamily, type FamilyExport } from '@/entities/auth/api'
import { useAuthStore, type Principal } from '@/entities/auth/model'
import { createStudent, getStudents, type Student } from '@/entities/student/api'
import { ApiError } from '@/shared/api/client'
import { CurriculumPage } from '@/pages/CurriculumPage'
import { LessonEditorPage } from '@/pages/LessonEditorPage'
import { StudentLessonPage } from '@/pages/StudentLessonPage'
import { getTodayLessons, type TodayLesson } from '@/entities/learning/api'
import { WeeklyPlanPage } from '@/pages/WeeklyPlanPage'
import { ProgressReportPage } from '@/pages/ProgressReportPage'
import { ReviewQueuePage } from '@/pages/ReviewQueuePage'
import { StudentAchievementsPage } from '@/pages/StudentAchievementsPage'
import { StudentProgressPage } from '@/pages/StudentProgressPage'
import { ReviewSessionPage } from '@/pages/ReviewSessionPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function ErrorText({ error }: { error: unknown }) {
  return error ? <p className="form-error" role="alert">{error instanceof Error ? error.message : 'Произошла ошибка'}</p> : null
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function LoginPage() {
  const navigate = useNavigate()
  const setPrincipal = useAuthStore((state) => state.setPrincipal)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: loginParent,
    onSuccess: async () => {
      const { principal } = await getMe()
      setPrincipal(principal)
      void navigate('/children', { replace: true })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({ email, password })
  }

  return <AuthLayout title="Вход для родителя" subtitle="Управляйте программой Сары и Давида в одном семейном пространстве.">
    <form className="stack" onSubmit={submit}>
      <Field label="Email"><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label="Пароль"><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
      <ErrorText error={mutation.error} />
      <button disabled={mutation.isPending}>{mutation.isPending ? 'Входим…' : 'Войти'}</button>
      <NavLink className="text-link" to="/setup">Первичная настройка семьи</NavLink>
    </form>
  </AuthLayout>
}

function SetupPage() {
  const navigate = useNavigate()
  const setPrincipal = useAuthStore((state) => state.setPrincipal)
  const [form, setForm] = useState({ setupToken: '', familyName: 'Семья', displayName: '', email: '', password: '' })
  const mutation = useMutation({
    mutationFn: setupFamily,
    onSuccess: async () => {
      const { principal } = await getMe()
      setPrincipal(principal)
      void navigate('/children', { replace: true })
    },
  })
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return <AuthLayout title="Создание семейного пространства" subtitle="Выполняется один раз после установки HomeEdu на сервер.">
    <form className="stack" onSubmit={(event) => { event.preventDefault(); mutation.mutate(form) }}>
      <Field label="Ключ установки"><input type="password" required value={form.setupToken} onChange={(event) => update('setupToken', event.target.value)} /></Field>
      <Field label="Название семьи"><input required value={form.familyName} onChange={(event) => update('familyName', event.target.value)} /></Field>
      <Field label="Имя родителя"><input required value={form.displayName} onChange={(event) => update('displayName', event.target.value)} /></Field>
      <Field label="Email"><input type="email" required value={form.email} onChange={(event) => update('email', event.target.value)} /></Field>
      <Field label="Пароль (минимум 12 символов)"><input type="password" minLength={12} required value={form.password} onChange={(event) => update('password', event.target.value)} /></Field>
      <ErrorText error={mutation.error} />
      <button disabled={mutation.isPending}>{mutation.isPending ? 'Создаём…' : 'Создать пространство'}</button>
      <NavLink className="text-link" to="/login">Вернуться ко входу</NavLink>
    </form>
  </AuthLayout>
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="brand brand-dark">Home<span>Edu</span></div><p className="eyebrow">Семейное образование</p><h1>{title}</h1><p className="muted">{subtitle}</p>{children}</section></main>
}

function AppShell({ principal, children }: { principal: Principal; children: ReactNode }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const setPrincipal = useAuthStore((state) => state.setPrincipal)
  const exit = useMutation({ mutationFn: logout, onSettled: () => { setPrincipal(null); client.clear(); void navigate('/login', { replace: true }) } })
  return <div className="app-shell"><aside className="sidebar"><div className="brand">Home<span>Edu</span></div><nav>{principal.role === 'parent' ? <><NavLink to="/children">Дети</NavLink><NavLink to="/reviews">Проверка работ</NavLink></> : <><NavLink to="/today">Сегодня</NavLink><NavLink to="/progress">Прогресс</NavLink><NavLink to="/achievements">Достижения</NavLink></>}</nav><div className="account"><strong>{principal.displayName}</strong><small>{principal.role === 'parent' ? 'Родитель' : `${principal.grade} класс`}</small><button className="button-secondary" onClick={() => exit.mutate()}>Выйти</button></div></aside><main>{children}</main></div>
}

function CreateStudentForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ displayName: '', grade: '4', age: '', pin: '' })
  const mutation = useMutation({
    mutationFn: createStudent,
    onSuccess: onDone,
  })
  return <form className="card stack" onSubmit={(event) => {
    event.preventDefault()
    mutation.mutate({ displayName: form.displayName, grade: Number(form.grade), age: form.age ? Number(form.age) : undefined, pin: form.pin })
  }}>
    <h2>Добавить ребёнка</h2>
    <Field label="Имя"><input required maxLength={120} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
    <div className="form-row"><Field label="Класс"><select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>{Array.from({ length: 11 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></Field><Field label="Возраст"><input type="number" min="5" max="19" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></Field></div>
    <Field label="PIN ребёнка (4–8 цифр)"><input inputMode="numeric" pattern="[0-9]{4,8}" required value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} /></Field>
    <ErrorText error={mutation.error} /><button disabled={mutation.isPending}>Добавить</button>
  </form>
}

function StudentCard({ student, onLoggedIn }: { student: Student; onLoggedIn: (principal: Principal) => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const mutation = useMutation({
    mutationFn: () => loginStudent({ studentId: student.id, pin }),
    onSuccess: async () => onLoggedIn((await getMe()).principal),
  })
  return <article className="card child-card"><div className="avatar" style={{ background: student.avatarColor }}>{student.displayName.slice(0, 1).toUpperCase()}</div><div><h2>{student.displayName}</h2><p className="muted">{student.grade} класс{student.age ? ` · ${student.age} лет` : ''}</p></div><span className="badge">Профиль ученика</span><div className="card-actions"><NavLink className="button-link button-ghost" to={`/children/${student.id}/curriculum`}>Учебная программа</NavLink><NavLink className="button-link button-ghost" to={`/children/${student.id}/plan`}>План недели</NavLink><NavLink className="button-link button-ghost" to={`/children/${student.id}/report`}>Отчёт</NavLink>{open ? <form className="pin-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><input aria-label={`PIN для ${student.displayName}`} autoFocus inputMode="numeric" pattern="[0-9]{4,8}" placeholder="Введите PIN" required value={pin} onChange={(event) => setPin(event.target.value)} /><button disabled={mutation.isPending}>Войти</button><ErrorText error={mutation.error} /></form> : <button onClick={() => setOpen(true)}>Перейти в профиль</button>}</div></article>
}

function ChildrenPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const setPrincipal = useAuthStore((state) => state.setPrincipal)
  const students = useQuery({ queryKey: ['students'], queryFn: getStudents })
  const [showForm, setShowForm] = useState(false)
  const download = (data: FamilyExport) => { const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`homeedu-family-${data.generatedAt.slice(0,10)}.json`;document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url) }
  const familyExport = useMutation({ mutationFn: exportFamilyData, onSuccess: download })
  const loggedIn = (principal: Principal) => { setPrincipal(principal); client.clear(); void navigate('/today', { replace: true }) }
  return <><header className="page-header"><p className="eyebrow">Семейное пространство</p><div className="header-row"><div><h1>Ученики</h1><p className="muted">Выберите профиль или добавьте нового ребёнка.</p></div><div className="header-actions"><button className="button-ghost" disabled={familyExport.isPending} onClick={() => familyExport.mutate()}>{familyExport.isPending ? 'Готовим экспорт…' : 'Скачать данные'}</button><button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Закрыть' : '+ Добавить ребёнка'}</button></div></div></header>{showForm && <CreateStudentForm onDone={() => { void client.invalidateQueries({ queryKey: ['students'] }); setShowForm(false) }} />}<ErrorText error={students.error ?? familyExport.error} />{students.isLoading ? <p>Загружаем профили…</p> : <section className="children-grid">{students.data?.students.map((student) => <StudentCard key={student.id} student={student} onLoggedIn={loggedIn} />)}{students.data?.students.length === 0 && <div className="card empty"><h2>Пока нет учеников</h2><p className="muted">Добавьте Сару и Давида, укажите класс и отдельный PIN для каждого.</p></div>}</section>}</>
}

function TodayPage({ principal }: { principal: Principal }) {
  const lessons = useQuery({ queryKey: ['student-lessons'], queryFn: getTodayLessons })
  const completed = lessons.data?.lessons.filter((lesson) => lesson.progress.status === 'completed').length ?? 0
  const reviews = lessons.data?.reviewTasks ?? []
  const continuation = lessons.data?.continueLesson
  return <><header className="page-header"><p className="eyebrow">Сегодня</p><h1>Привет, {principal.displayName}!</h1><p className="muted">{principal.grade} класс · пройдено {completed} из {lessons.data?.lessons.length ?? 0}</p></header><ErrorText error={lessons.error} />
    {continuation && <section className="continue-lesson card" style={{ borderLeftColor: continuation.subjectColor }}><div><span className="badge">Продолжить занятие</span><h2>{continuation.title}</h2><p className="muted">{continuation.subjectTitle} · {continuation.topicTitle}</p><div className="progress-track"><div style={{ width: `${continuation.blockCount ? Math.round((continuation.progress.lastBlockPosition / continuation.blockCount) * 100) : 0}%`, background: continuation.subjectColor }} /></div></div><NavLink className="button-link" to={`/study/lessons/${continuation.id}`}>Продолжить →</NavLink></section>}
    {reviews.length > 0 && <section className="review-reminder card"><div><span className="badge">На сегодня</span><h2>Короткая контрольная</h2><p className="muted">Система выбрала несколько вопросов по теме.</p></div><ul>{reviews.map((task) => <li key={task.id}><strong>{task.topicTitle}</strong><span>{task.subjectTitle} · {task.reason}</span><NavLink className="button-link button-small" to={`/reviews/${task.id}`}>Начать повторение →</NavLink></li>)}</ul></section>}
    {lessons.isLoading ? <p>Собираем план на сегодня…</p> : lessons.data?.lessons.length ? <section className="student-lessons">{lessons.data.lessons.map((lesson) => <StudentLessonCard key={lesson.planItemId} lesson={lesson} />)}</section> : reviews.length === 0 ? <section className="card empty"><h2>На сегодня всё свободно</h2><p className="muted">В плане нет уроков и повторений.</p></section> : null}
  </>
}

function StudentLessonCard({ lesson }: { lesson: TodayLesson }) {
  const labels = { not_started: 'Начать', in_progress: 'Продолжить', completed: 'Пройдено' }
  const statusLabels = { assigned: 'Назначено', in_progress: 'В работе', submitted: 'Отправлено', needs_revision: 'Нужна доработка', reviewed: 'Проверено' }
  const percent = lesson.progress.status === 'completed' ? 100 : lesson.blockCount ? Math.round((lesson.progress.lastBlockPosition / lesson.blockCount) * 100) : 0
  return <article className="card student-lesson-card" style={{ borderTopColor: lesson.subjectColor }}><div className="lesson-card-heading"><span className="badge" style={{ color: lesson.subjectColor }}>{lesson.subjectTitle}</span><span className={`lesson-status status-${lesson.planStatus}`}>{statusLabels[lesson.planStatus]}</span></div><h2>{lesson.title}</h2><p className="muted">{lesson.sectionTitle} · {lesson.topicTitle}</p>{lesson.summary && <p>{lesson.summary}</p>}<div className="progress-track"><div style={{ width: `${percent}%`, background: lesson.subjectColor }} /></div><div className="lesson-card-footer"><small>{lesson.blockCount} шагов{lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} мин` : ''}</small><NavLink className="button-link" to={`/study/lessons/${lesson.id}`}>{labels[lesson.progress.status]} →</NavLink></div></article>
}

function RoutedApp() {
  const principal = useAuthStore((state) => state.principal)
  const setPrincipal = useAuthStore((state) => state.setPrincipal)
  const session = useQuery({ queryKey: ['me'], queryFn: getMe })
  useEffect(() => { if (session.data) setPrincipal(session.data.principal); if (session.error instanceof ApiError && session.error.status === 401) setPrincipal(null) }, [session.data, session.error, setPrincipal])
  if (session.isLoading) return <main className="splash"><div className="brand brand-dark">Home<span>Edu</span></div><p>Проверяем сессию…</p></main>
  return <Routes>
    <Route path="/login" element={principal ? <Navigate to={principal.role === 'parent' ? '/children' : '/today'} replace /> : <LoginPage />} />
    <Route path="/setup" element={principal ? <Navigate to="/children" replace /> : <SetupPage />} />
    <Route path="/children" element={principal?.role === 'parent' ? <AppShell principal={principal}><ChildrenPage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/children/:studentId/curriculum" element={principal?.role === 'parent' ? <AppShell principal={principal}><CurriculumPage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/children/:studentId/plan" element={principal?.role === 'parent' ? <AppShell principal={principal}><WeeklyPlanPage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/children/:studentId/report" element={principal?.role === 'parent' ? <AppShell principal={principal}><ProgressReportPage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/reviews" element={principal?.role === 'parent' ? <AppShell principal={principal}><ReviewQueuePage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/lessons/:lessonId/edit" element={principal?.role === 'parent' ? <AppShell principal={principal}><LessonEditorPage /></AppShell> : <Navigate to={principal ? '/today' : '/login'} replace />} />
    <Route path="/today" element={principal?.role === 'student' ? <AppShell principal={principal}><TodayPage principal={principal} /></AppShell> : <Navigate to={principal ? '/children' : '/login'} replace />} />
    <Route path="/achievements" element={principal?.role === 'student' ? <AppShell principal={principal}><StudentAchievementsPage /></AppShell> : <Navigate to={principal ? '/children' : '/login'} replace />} />
    <Route path="/progress" element={principal?.role === 'student' ? <AppShell principal={principal}><StudentProgressPage /></AppShell> : <Navigate to={principal ? '/children' : '/login'} replace />} />
    <Route path="/reviews/:reviewId" element={principal?.role === 'student' ? <AppShell principal={principal}><ReviewSessionPage /></AppShell> : <Navigate to={principal ? '/children' : '/login'} replace />} />
    <Route path="/study/lessons/:lessonId" element={principal?.role === 'student' ? <AppShell principal={principal}><StudentLessonPage /></AppShell> : <Navigate to={principal ? '/children' : '/login'} replace />} />
    <Route path="*" element={<Navigate to={principal?.role === 'student' ? '/today' : principal ? '/children' : '/login'} replace />} />
  </Routes>
}

export function App() {
  return <QueryClientProvider client={queryClient}><RoutedApp /></QueryClientProvider>
}
