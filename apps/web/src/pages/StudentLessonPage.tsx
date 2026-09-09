import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useParams } from 'react-router-dom'
import { useState } from 'react'
import { getStudentLesson, saveLessonProgress, saveReflection, submitQuizAttempt, type ReflectionFeeling, type StudentQuiz } from '@/entities/learning/api'
import type { LessonBlock } from '@/entities/curriculum/api'

function LearningBlock({ block }: { block: LessonBlock }) {
  if (block.blockType === 'markdown' || block.blockType === 'example') return <article className={`learning-block ${block.blockType === 'example' ? 'learning-example' : ''}`}>{block.blockType === 'example' && <span className="badge">Пример</span>}<p>{block.content.text}</p></article>
  if (block.blockType === 'image') return <figure className="learning-block"><img src={block.content.url} alt={block.content.caption ?? 'Иллюстрация к уроку'} />{block.content.caption && <figcaption>{block.content.caption}</figcaption>}</figure>
  return <article className="learning-block resource-block"><span className="badge">{block.blockType === 'video' ? 'Видео' : 'Материал'}</span><a href={block.content.url} target="_blank" rel="noreferrer">{block.content.caption || 'Открыть материал ↗'}</a></article>
}

function StudentQuizCard({ quiz }: { quiz: StudentQuiz }) {
  const [selected, setSelected] = useState<number | null>(null)
  const attempt = useMutation({ mutationFn: () => submitQuizAttempt(quiz.id, selected as number) })
  const result = attempt.data?.attempt
  return <form className="card student-quiz" onSubmit={(event) => { event.preventDefault(); attempt.mutate() }}><span className="badge">Мини-тест</span><h2>{quiz.title}</h2><p className="quiz-prompt">{quiz.question.prompt}</p><div className="quiz-options">{quiz.question.options.map((option, index) => <label className={selected === index ? 'quiz-option selected-option' : 'quiz-option'} key={`${index}-${option}`}><input type="radio" name={`quiz-${quiz.id}`} checked={selected === index} disabled={Boolean(result)} onChange={() => setSelected(index)} /><span>{option}</span></label>)}</div>{!result && <button disabled={selected === null || attempt.isPending}>Проверить ответ</button>}{result && <div className={result.correct ? 'quiz-result quiz-correct' : 'quiz-result quiz-wrong'}><strong>{result.correct ? 'Верно! Отличная работа.' : 'Пока неверно — попробуй разобраться ещё раз.'}</strong>{result.explanation && <p>{result.explanation}</p>}<button type="button" className="button-ghost" onClick={() => { setSelected(null); attempt.reset() }}>Попробовать ещё раз</button></div>}{attempt.error && <p className="form-error">{attempt.error.message}</p>}</form>
}

export function StudentLessonPage() {
  const { lessonId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['student-lesson', lessonId], queryFn: () => getStudentLesson(lessonId), enabled: Boolean(lessonId) })
  const lesson = query.data?.lesson
  const initialStep = lesson?.progress.status === 'completed' ? lesson.blocks.length : Math.min(lesson?.progress.lastBlockPosition ?? 0, lesson?.blocks.length ?? 0)
  const [chosenVisibleCount, setVisibleCount] = useState<number | null>(null)
  const [feeling, setFeeling] = useState<ReflectionFeeling | ''>('')
  const [comment, setComment] = useState('')
  const visibleCount = chosenVisibleCount ?? Math.max(1, initialStep)
  const progress = lesson?.blocks.length ? Math.round((Math.min(visibleCount, lesson.blocks.length) / lesson.blocks.length) * 100) : 0
  const completed = lesson?.progress.status === 'completed' || Boolean(lesson && visibleCount >= lesson.blocks.length)
  const save = useMutation({ mutationFn: ({ position, finish }: { position: number; finish: boolean }) => saveLessonProgress(lessonId, position, finish), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['student-lesson', lessonId] }), client.invalidateQueries({ queryKey: ['student-lessons'] })]) } })
  const reflection = useMutation({ mutationFn: () => saveReflection(lessonId, feeling as ReflectionFeeling, comment), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['student-lesson', lessonId] }) } })
  const next = () => { if (!lesson) return; const count = Math.min(visibleCount + 1, lesson.blocks.length); setVisibleCount(count); save.mutate({ position: count, finish: count >= lesson.blocks.length }) }

  if (query.isLoading) return <p>Открываем урок…</p>
  if (!lesson) return <section className="card empty"><h2>Урок не найден</h2><NavLink className="button-link button-ghost" to="/today">Вернуться к урокам</NavLink></section>
  return <div className="focus-lesson"><header className="lesson-focus-header"><NavLink className="text-link" to="/today">← Мои уроки</NavLink><div><p className="eyebrow" style={{ color: lesson.subjectColor }}>{lesson.subjectTitle}</p><h1>{lesson.title}</h1><p className="muted">{lesson.sectionTitle} · {lesson.topicTitle}</p></div><div className="progress-wrap"><div className="progress-label"><strong>{completed ? 'Готово!' : 'Прохождение урока'}</strong><span>{completed ? 100 : progress}%</span></div><div className="progress-track"><div style={{ width: `${completed ? 100 : progress}%`, background: lesson.subjectColor }} /></div></div></header>
    <section className="learning-content">{lesson.blocks.slice(0, visibleCount).map((block) => <LearningBlock key={block.id} block={block} />)}{lesson.blocks.length === 0 && <div className="card empty"><h2>В уроке пока нет материалов</h2><p className="muted">Попроси родителя добавить содержание.</p></div>}{completed && lesson.quizzes.map((quiz) => <StudentQuizCard key={quiz.id} quiz={quiz} />)}</section>
    {lesson.blocks.length > 0 && <footer className="lesson-next">{completed ? <><div className="completion-card"><span aria-hidden="true">✓</span><div><h2>Урок пройден</h2><p>Отличная работа! Результат сохранён.</p></div><NavLink className="button-link" to="/today">К списку уроков</NavLink></div><form className="card reflection-card" onSubmit={(event) => { event.preventDefault(); reflection.mutate() }}><div><h2>Как тебе было?</h2><p className="muted">Это не оценка — ответ поможет подобрать следующий урок.</p></div><div className="feeling-options">{([['easy','Легко'],['good','Получилось'],['hard','Трудно'],['need_help','Нужна помощь']] as const).map(([value,label]) => <button type="button" className={feeling === value ? 'feeling-selected' : 'button-ghost'} key={value} onClick={() => setFeeling(value)}>{label}</button>)}</div><textarea maxLength={500} rows={2} placeholder="Можно коротко написать, что было сложно" value={comment} onChange={(event) => setComment(event.target.value)} /><button disabled={!feeling || reflection.isPending}>{lesson.reflection || reflection.isSuccess ? 'Обновить ответ' : 'Сохранить ответ'}</button>{lesson.reflection && !reflection.isSuccess && <p className="saved-note">Ответ уже сохранён: {lesson.reflection.feeling === 'need_help' ? 'нужна помощь' : 'спасибо!'}</p>}{reflection.isSuccess && <p className="saved-note">Спасибо, ответ сохранён.</p>}{reflection.error && <p className="form-error">{reflection.error.message}</p>}</form></> : <button disabled={save.isPending} onClick={next}>{visibleCount + 1 >= lesson.blocks.length ? 'Завершить урок' : 'Дальше →'}</button>}{save.error && <p className="form-error" role="alert">{save.error.message}</p>}</footer>}
  </div>
}
