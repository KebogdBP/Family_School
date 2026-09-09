import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  attachSubject, createCurriculum, createLesson, createSection, createSubject, createTopic,
  deleteCurriculumNode, getCurricula, getCurriculum, getSubjects, updateCurriculumNode,
  type CurriculumNodeType, type CurriculumTree,
} from '@/entities/curriculum/api'
import { getStudents } from '@/entities/student/api'

function ErrorText({ error }: { error: unknown }) {
  return error ? <p className="form-error" role="alert">{error instanceof Error ? error.message : 'Произошла ошибка'}</p> : null
}

function AddNodeForm({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (title: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const mutation = useMutation({ mutationFn: () => onAdd(title), onSuccess: () => { setTitle(''); setOpen(false) } })
  if (!open) return <button className="button-ghost button-small" onClick={() => setOpen(true)}>+ {label}</button>
  return <form className="inline-create" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <input autoFocus required maxLength={180} placeholder={placeholder} value={title} onChange={(event) => setTitle(event.target.value)} />
    <button disabled={mutation.isPending}>Добавить</button>
    <button type="button" className="button-ghost" onClick={() => setOpen(false)}>Отмена</button>
    <ErrorText error={mutation.error} />
  </form>
}

function NodeActions({ type, id, title, position, summary, onChanged }: {
  type: CurriculumNodeType
  id: string
  title: string
  position: number
  summary?: string | null
  onChanged: () => Promise<unknown>
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle')
  const [value, setValue] = useState(title)
  const update = useMutation({
    mutationFn: () => updateCurriculumNode(type, id, {
      title: value,
      position,
      ...(type === 'lessons' ? { summary: summary ?? '' } : { description: '' }),
    }),
    onSuccess: async () => { setMode('idle'); await onChanged() },
  })
  const remove = useMutation({
    mutationFn: () => deleteCurriculumNode(type, id),
    onSuccess: onChanged,
  })
  if (mode === 'edit') return <form className="node-edit" onSubmit={(event) => { event.preventDefault(); update.mutate() }}><input aria-label="Новое название" autoFocus required maxLength={180} value={value} onChange={(event) => setValue(event.target.value)} /><button disabled={update.isPending}>Сохранить</button><button type="button" className="button-ghost" onClick={() => { setValue(title); setMode('idle') }}>Отмена</button><ErrorText error={update.error} /></form>
  if (mode === 'delete') return <div className="delete-confirm"><span>Удалить «{title}»?</span><button className="button-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Да, удалить</button><button className="button-ghost" onClick={() => setMode('idle')}>Отмена</button><ErrorText error={remove.error} /></div>
  return <div className="node-actions"><button className="icon-button" aria-label={`Редактировать ${title}`} title="Редактировать" onClick={() => setMode('edit')}>✎</button><button className="icon-button icon-danger" aria-label={`Удалить ${title}`} title="Удалить" onClick={() => setMode('delete')}>×</button></div>
}

function CurriculumCreator({ studentId, grade }: { studentId: string; grade: number }) {
  const client = useQueryClient()
  const [title, setTitle] = useState(`${grade} класс`)
  const [schoolYear, setSchoolYear] = useState('2026/2027')
  const mutation = useMutation({
    mutationFn: () => createCurriculum({ studentId, title, schoolYear }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['curricula', studentId] }),
  })
  return <section className="card program-empty"><h2>Создайте учебную программу</h2><p className="muted">Она объединит предметы и сохранит отдельный маршрут для этого ребёнка.</p><form className="stack compact-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><label className="field"><span>Название</span><input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Учебный год</span><input required pattern="[0-9]{4}/[0-9]{4}" value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label><ErrorText error={mutation.error} /><button disabled={mutation.isPending}>Создать программу</button></form></section>
}

function SubjectToolbar({ tree }: { tree: CurriculumTree }) {
  const client = useQueryClient()
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: getSubjects })
  const [subjectId, setSubjectId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const refresh = () => void client.invalidateQueries({ queryKey: ['curriculum', tree.id] })
  const attach = useMutation({ mutationFn: () => attachSubject(tree.id, subjectId, tree.subjects.length), onSuccess: refresh })
  const createAndAttach = useMutation({
    mutationFn: async () => {
      const created = await createSubject({ title: newTitle })
      return attachSubject(tree.id, created.subject.id, tree.subjects.length)
    },
    onSuccess: () => { setNewTitle(''); void client.invalidateQueries({ queryKey: ['subjects'] }); refresh() },
  })
  const assigned = new Set(tree.subjects.map((subject) => subject.id))
  const available = subjects.data?.subjects.filter((subject) => !assigned.has(subject.id)) ?? []
  return <section className="card subject-toolbar"><div><h2>Добавить предмет</h2><p className="muted">Выберите существующий или создайте свой.</p></div><form onSubmit={(event) => { event.preventDefault(); attach.mutate() }}><select aria-label="Существующий предмет" required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Выберите предмет</option>{available.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}</select><button disabled={attach.isPending || !subjectId}>Назначить</button></form><form onSubmit={(event) => { event.preventDefault(); createAndAttach.mutate() }}><input aria-label="Название нового предмета" required placeholder="Например, Астрономия" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /><button disabled={createAndAttach.isPending}>Создать</button></form><ErrorText error={subjects.error ?? attach.error ?? createAndAttach.error} /></section>
}

function ProgramTree({ tree }: { tree: CurriculumTree }) {
  const client = useQueryClient()
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['curriculum', tree.id] }) }
  if (tree.subjects.length === 0) return <div className="card empty"><h2>В программе пока нет предметов</h2><p className="muted">Добавьте первый предмет выше.</p></div>
  return <section className="program-tree">{tree.subjects.map((subject) => <article className="subject-card card" key={subject.assignmentId} style={{ borderTopColor: subject.color }}><header><div className="subject-dot" style={{ background: subject.color }} /><h2>{subject.title}</h2></header><div className="tree-list">{subject.sections.map((section) => <section className="tree-section" key={section.id}><div className="node-heading"><h3>{section.title}</h3><NodeActions type="sections" id={section.id} title={section.title} position={section.position} onChanged={refresh} /></div><div className="topic-list">{section.topics.map((topic) => <div className="tree-topic" key={topic.id}><div className="node-heading"><strong>{topic.title}</strong><NodeActions type="topics" id={topic.id} title={topic.title} position={topic.position} onChanged={refresh} /></div><ol>{topic.lessons.map((lesson) => <li key={lesson.id}><div className="lesson-row"><NavLink className="lesson-link" to={`/lessons/${lesson.id}/edit`}>{lesson.title}</NavLink><small>{lesson.status === 'draft' ? 'Черновик' : 'Опубликован'}</small><NodeActions type="lessons" id={lesson.id} title={lesson.title} position={lesson.position} summary={lesson.summary} onChanged={refresh} /></div></li>)}</ol><AddNodeForm label="урок" placeholder="Название урока" onAdd={async (title) => { await createLesson(topic.id, title, topic.lessons.length); await refresh() }} /></div>)}</div><AddNodeForm label="тему" placeholder="Название темы" onAdd={async (title) => { await createTopic(section.id, title, section.topics.length); await refresh() }} /></section>)}</div><AddNodeForm label="раздел" placeholder="Название раздела" onAdd={async (title) => { await createSection(subject.assignmentId, title, subject.sections.length); await refresh() }} /></article>)}</section>
}

export function CurriculumPage() {
  const { studentId = '' } = useParams()
  const students = useQuery({ queryKey: ['students'], queryFn: getStudents })
  const curricula = useQuery({ queryKey: ['curricula', studentId], queryFn: () => getCurricula(studentId), enabled: Boolean(studentId) })
  const student = students.data?.students.find((item) => item.id === studentId)
  const curriculumId = curricula.data?.curricula[0]?.id
  const tree = useQuery({ queryKey: ['curriculum', curriculumId], queryFn: () => getCurriculum(curriculumId!), enabled: Boolean(curriculumId) })
  return <><header className="page-header"><p className="eyebrow">Учебная программа</p><div className="header-row"><div><h1>{student ? `Программа: ${student.displayName}` : 'Программа ученика'}</h1><p className="muted">Предметы, разделы, темы и уроки в правильном порядке.</p></div><NavLink className="button-link button-ghost" to="/children">← К ученикам</NavLink></div></header><ErrorText error={students.error ?? curricula.error ?? tree.error} />{students.isLoading || curricula.isLoading ? <p>Загружаем программу…</p> : !student ? <div className="card empty"><h2>Ученик не найден</h2></div> : !curriculumId ? <CurriculumCreator studentId={student.id} grade={student.grade} /> : tree.data ? <><SubjectToolbar tree={tree.data.curriculum} /><ProgramTree tree={tree.data.curriculum} /></> : <p>Загружаем содержание…</p>}</>
}
