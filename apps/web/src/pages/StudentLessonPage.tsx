import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useParams } from 'react-router-dom'
import { useState } from 'react'
import { getStudentLesson, saveLessonProgress } from '@/entities/learning/api'
import type { LessonBlock } from '@/entities/curriculum/api'

function LearningBlock({ block }: { block: LessonBlock }) {
  if (block.blockType === 'markdown' || block.blockType === 'example') return <article className={`learning-block ${block.blockType === 'example' ? 'learning-example' : ''}`}>{block.blockType === 'example' && <span className="badge">Пример</span>}<p>{block.content.text}</p></article>
  if (block.blockType === 'image') return <figure className="learning-block"><img src={block.content.url} alt={block.content.caption ?? 'Иллюстрация к уроку'} />{block.content.caption && <figcaption>{block.content.caption}</figcaption>}</figure>
  return <article className="learning-block resource-block"><span className="badge">{block.blockType === 'video' ? 'Видео' : 'Материал'}</span><a href={block.content.url} target="_blank" rel="noreferrer">{block.content.caption || 'Открыть материал ↗'}</a></article>
}

export function StudentLessonPage() {
  const { lessonId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['student-lesson', lessonId], queryFn: () => getStudentLesson(lessonId), enabled: Boolean(lessonId) })
  const lesson = query.data?.lesson
  const initialStep = lesson?.progress.status === 'completed' ? lesson.blocks.length : Math.min(lesson?.progress.lastBlockPosition ?? 0, lesson?.blocks.length ?? 0)
  const [chosenVisibleCount, setVisibleCount] = useState<number | null>(null)
  const visibleCount = chosenVisibleCount ?? Math.max(1, initialStep)
  const progress = lesson?.blocks.length ? Math.round((Math.min(visibleCount, lesson.blocks.length) / lesson.blocks.length) * 100) : 0
  const completed = lesson?.progress.status === 'completed' || Boolean(lesson && visibleCount >= lesson.blocks.length)
  const save = useMutation({ mutationFn: ({ position, finish }: { position: number; finish: boolean }) => saveLessonProgress(lessonId, position, finish), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['student-lesson', lessonId] }), client.invalidateQueries({ queryKey: ['student-lessons'] })]) } })
  const next = () => { if (!lesson) return; const count = Math.min(visibleCount + 1, lesson.blocks.length); setVisibleCount(count); save.mutate({ position: count, finish: count >= lesson.blocks.length }) }

  if (query.isLoading) return <p>Открываем урок…</p>
  if (!lesson) return <section className="card empty"><h2>Урок не найден</h2><NavLink className="button-link button-ghost" to="/today">Вернуться к урокам</NavLink></section>
  return <div className="focus-lesson"><header className="lesson-focus-header"><NavLink className="text-link" to="/today">← Мои уроки</NavLink><div><p className="eyebrow" style={{ color: lesson.subjectColor }}>{lesson.subjectTitle}</p><h1>{lesson.title}</h1><p className="muted">{lesson.sectionTitle} · {lesson.topicTitle}</p></div><div className="progress-wrap"><div className="progress-label"><strong>{completed ? 'Готово!' : 'Прохождение урока'}</strong><span>{completed ? 100 : progress}%</span></div><div className="progress-track"><div style={{ width: `${completed ? 100 : progress}%`, background: lesson.subjectColor }} /></div></div></header>
    <section className="learning-content">{lesson.blocks.slice(0, visibleCount).map((block) => <LearningBlock key={block.id} block={block} />)}{lesson.blocks.length === 0 && <div className="card empty"><h2>В уроке пока нет материалов</h2><p className="muted">Попроси родителя добавить содержание.</p></div>}</section>
    {lesson.blocks.length > 0 && <footer className="lesson-next">{completed ? <div className="completion-card"><span aria-hidden="true">✓</span><div><h2>Урок пройден</h2><p>Отличная работа! Результат сохранён.</p></div><NavLink className="button-link" to="/today">К списку уроков</NavLink></div> : <button disabled={save.isPending} onClick={next}>{visibleCount + 1 >= lesson.blocks.length ? 'Завершить урок' : 'Дальше →'}</button>}{save.error && <p className="form-error" role="alert">{save.error.message}</p>}</footer>}
  </div>
}
