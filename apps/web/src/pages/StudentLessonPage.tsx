import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useParams } from 'react-router-dom'
import { useState } from 'react'
import { deleteHomeworkFile, getStudentLesson, requestAiHint, saveHomeworkSubmission, saveLessonProgress, saveReflection, submitQuizAttempt, uploadHomeworkFile, type ReflectionFeeling, type StudentHomework, type StudentQuiz } from '@/entities/learning/api'
import type { LessonBlock } from '@/entities/curriculum/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/PageState'

function LearningBlock({ block }: { block: LessonBlock }) {
  if (block.blockType === 'markdown' || block.blockType === 'example') return <article className={`learning-block ${block.blockType === 'example' ? 'learning-example' : ''}`}>{block.blockType === 'example' && <span className="badge">Пример</span>}<p>{block.content.text}</p></article>
  if (block.blockType === 'image') return <figure className="learning-block"><img src={block.content.url} alt={block.content.caption ?? 'Иллюстрация к уроку'} />{block.content.caption && <figcaption>{block.content.caption}</figcaption>}</figure>
  return <article className="learning-block resource-block"><span className="badge">{block.blockType === 'video' ? 'Видео' : 'Материал'}</span><a href={block.content.url} target="_blank" rel="noreferrer">{block.content.caption || 'Открыть материал ↗'}</a></article>
}

function StudentQuizCard({ quiz }: { quiz: StudentQuiz }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [selectedMany, setSelectedMany] = useState<number[]>([])
  const [written, setWritten] = useState('')
  const answer = quiz.question.questionType === 'single_choice' ? { selectedOption: selected ?? undefined }
    : quiz.question.questionType === 'multiple_choice' ? { selectedOptions: selectedMany }
      : quiz.question.questionType === 'number' ? { numberAnswer: written === '' ? undefined : Number(written) }
        : { textAnswer: written }
  const canSubmit = quiz.question.questionType === 'single_choice' ? selected !== null : quiz.question.questionType === 'multiple_choice' ? selectedMany.length > 0 : written.trim() !== ''
  const attempt = useMutation({ mutationFn: () => submitQuizAttempt(quiz.id, answer) })
  const result = attempt.data?.attempt
  const reset = () => { setSelected(null); setSelectedMany([]); setWritten(''); attempt.reset() }
  return <form className="card student-quiz" onSubmit={(event) => { event.preventDefault(); attempt.mutate() }}><span className="badge">Мини-тест</span><h2>{quiz.title}</h2><p className="quiz-prompt">{quiz.question.prompt}</p>
    {(quiz.question.questionType === 'single_choice' || quiz.question.questionType === 'multiple_choice') && <div className="quiz-options">{quiz.question.options.map((option, index) => { const active = quiz.question.questionType === 'single_choice' ? selected === index : selectedMany.includes(index); return <label className={active ? 'quiz-option selected-option' : 'quiz-option'} key={`${index}-${option}`}><input type={quiz.question.questionType === 'single_choice' ? 'radio' : 'checkbox'} name={`quiz-${quiz.id}`} checked={active} disabled={Boolean(result)} onChange={() => quiz.question.questionType === 'single_choice' ? setSelected(index) : setSelectedMany((values) => values.includes(index) ? values.filter((value) => value !== index) : [...values, index])} /><span>{option}</span></label> })}</div>}
    {quiz.question.questionType === 'number' && <label className="field"><span>Твой ответ</span><input type="number" step="any" required disabled={Boolean(result)} value={written} onChange={(event) => setWritten(event.target.value)} /></label>}
    {quiz.question.questionType === 'short_text' && <label className="field"><span>Твой ответ</span><input required maxLength={500} disabled={Boolean(result)} value={written} onChange={(event) => setWritten(event.target.value)} /></label>}
    {!result && <button disabled={!canSubmit || attempt.isPending}>Проверить ответ</button>}{result && <div className={result.correct ? 'quiz-result quiz-correct' : 'quiz-result quiz-wrong'}><strong>{result.correct ? 'Верно! Отличная работа.' : 'Пока неверно — попробуй разобраться ещё раз.'}</strong>{result.explanation && <p>{result.explanation}</p>}<button type="button" className="button-ghost" onClick={reset}>Попробовать ещё раз</button></div>}{attempt.error && <p className="form-error">{attempt.error.message}</p>}</form>
}

function HomeworkCard({ homework, refresh }: { homework: StudentHomework; refresh: () => Promise<unknown> }) {
  const [text, setText] = useState(homework.submission?.responseText ?? '')
  const save = useMutation({ mutationFn: (submit: boolean) => saveHomeworkSubmission(homework.id, text, submit), onSuccess: refresh })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!homework.submission) await saveHomeworkSubmission(homework.id, text, false)
      return uploadHomeworkFile(homework.id, file)
    },
    onSuccess: refresh,
  })
  const removeFile = useMutation({ mutationFn: deleteHomeworkFile, onSuccess: refresh })
  const locked = homework.submission?.status === 'submitted' || homework.submission?.status === 'reviewed'
  const error = save.error ?? upload.error ?? removeFile.error

  return <form className="card student-homework" onSubmit={(event) => { event.preventDefault(); save.mutate(true) }}>
    <span className="badge">Домашнее задание</span><h2>{homework.title}</h2><p>{homework.instructions}</p>
    {homework.submission?.reviewComment && <div className={homework.submission.status === 'needs_revision' ? 'review-feedback revision-feedback' : 'review-feedback'}><strong>{homework.submission.status === 'needs_revision' ? 'Нужно доработать' : 'Проверено'}{homework.submission.reviewGrade ? ` · оценка ${homework.submission.reviewGrade}` : ''}</strong><p>{homework.submission.reviewComment}</p></div>}
    <textarea rows={6} required maxLength={20000} disabled={locked} placeholder="Напиши ответ своими словами" value={text} onChange={(event) => setText(event.target.value)} />
    {homework.submission?.files.length ? <div className="submission-files"><strong>Прикреплённые файлы</strong>{homework.submission.files.map((file) => <div className="submission-file" key={file.id}><a href={file.url} target="_blank" rel="noreferrer">{file.originalName}</a><small>{Math.ceil(file.sizeBytes / 1024)} КБ</small>{!locked && <button type="button" className="icon-button icon-danger" aria-label={`Удалить ${file.originalName}`} disabled={removeFile.isPending} onClick={() => removeFile.mutate(file.id)}>×</button>}</div>)}</div> : null}
    {!locked && <label className="file-upload"><span>Фото тетради или PDF · до 10 МБ</span><input type="file" accept="image/jpeg,image/png,application/pdf" disabled={!text.trim() || upload.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = '' }} /></label>}
    {!locked && <div className="homework-actions"><button type="button" className="button-ghost" disabled={!text.trim() || save.isPending} onClick={() => save.mutate(false)}>Сохранить черновик</button><button disabled={!text.trim() || save.isPending || upload.isPending}>Отправить на проверку</button></div>}
    {homework.submission?.status === 'submitted' && <p className="saved-note">Работа отправлена и ждёт проверки.</p>}{homework.submission?.status === 'reviewed' && <p className="saved-note">Работа принята.</p>}{error && <p className="form-error">{error.message}</p>}
  </form>
}

function AiHint({ lessonId }: { lessonId: string }) {
  const [question,setQuestion]=useState('');const hint=useMutation({mutationFn:()=>requestAiHint(lessonId,question)})
  return <form className="card ai-hint" onSubmit={(event)=>{event.preventDefault();hint.mutate()}}><span className="badge">AI-помощник</span><h2>Нужна подсказка?</h2><p className="muted">Помощник задаст наводящий вопрос, но не выдаст готовый ответ.</p><textarea rows={2} maxLength={500} required placeholder="Напиши, на каком шаге стало трудно" value={question} onChange={(event)=>setQuestion(event.target.value)}/><button disabled={!question.trim()||hint.isPending}>{hint.isPending?'Думаю…':'Получить подсказку'}</button>{hint.data&&<div className="ai-hint-answer" role="status"><strong>Попробуй так:</strong><p>{hint.data.hint}</p></div>}{hint.error&&<p className="form-error">{hint.error.message}</p>}</form>
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

  if (query.isLoading) return <LoadingState label="Открываем урок…" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!lesson) return <EmptyState title="Урок не найден" description="Возможно, родитель изменил программу."><NavLink className="button-link button-ghost" to="/today">Вернуться к урокам</NavLink></EmptyState>
  return <div className="focus-lesson"><header className="lesson-focus-header"><NavLink className="text-link" to="/today">← Мои уроки</NavLink><div><p className="eyebrow" style={{ color: lesson.subjectColor }}>{lesson.subjectTitle}</p><h1>{lesson.title}</h1><p className="muted">{lesson.sectionTitle} · {lesson.topicTitle}</p></div><div className="progress-wrap"><div className="progress-label"><strong>{completed ? 'Готово!' : 'Прохождение урока'}</strong><span>{completed ? 100 : progress}%</span></div><div className="progress-track"><div style={{ width: `${completed ? 100 : progress}%`, background: lesson.subjectColor }} /></div></div></header>
    <section className="learning-content">{lesson.blocks.slice(0, visibleCount).map((block) => <LearningBlock key={block.id} block={block} />)}{lesson.blocks.length === 0 && <div className="card empty"><h2>В уроке пока нет материалов</h2><p className="muted">Попроси родителя добавить содержание.</p></div>}<AiHint lessonId={lessonId}/>{completed && lesson.quizzes.map((quiz) => <StudentQuizCard key={quiz.id} quiz={quiz} />)}{completed&&lesson.homeworks.map((homework)=><HomeworkCard key={homework.id} homework={homework} refresh={async()=>{await client.invalidateQueries({queryKey:['student-lesson',lessonId]})}}/>)}</section>
    {lesson.blocks.length > 0 && <footer className="lesson-next">{completed ? <><div className="completion-card"><span aria-hidden="true">✓</span><div><h2>Урок пройден</h2><p>Отличная работа! Результат сохранён.</p></div><NavLink className="button-link" to="/today">К списку уроков</NavLink></div><form className="card reflection-card" onSubmit={(event) => { event.preventDefault(); reflection.mutate() }}><div><h2>Как тебе было?</h2><p className="muted">Это не оценка — ответ поможет подобрать следующий урок.</p></div><div className="feeling-options">{([['easy','Легко'],['good','Получилось'],['hard','Трудно'],['need_help','Нужна помощь']] as const).map(([value,label]) => <button type="button" className={feeling === value ? 'feeling-selected' : 'button-ghost'} key={value} onClick={() => setFeeling(value)}>{label}</button>)}</div><textarea maxLength={500} rows={2} placeholder="Можно коротко написать, что было сложно" value={comment} onChange={(event) => setComment(event.target.value)} /><button disabled={!feeling || reflection.isPending}>{lesson.reflection || reflection.isSuccess ? 'Обновить ответ' : 'Сохранить ответ'}</button>{lesson.reflection && !reflection.isSuccess && <p className="saved-note">Ответ уже сохранён: {lesson.reflection.feeling === 'need_help' ? 'нужна помощь' : 'спасибо!'}</p>}{reflection.isSuccess && <p className="saved-note">Спасибо, ответ сохранён.</p>}{reflection.error && <p className="form-error">{reflection.error.message}</p>}</form></> : <button disabled={save.isPending} onClick={next}>{visibleCount + 1 >= lesson.blocks.length ? 'Завершить урок' : 'Дальше →'}</button>}{save.error && <p className="form-error" role="alert">{save.error.message}</p>}</footer>}
  </div>
}
