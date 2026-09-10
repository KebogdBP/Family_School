import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, useParams } from 'react-router-dom'
import { useState } from 'react'
import { getReviewSession, submitReviewSession, type QuizAnswer, type ReviewQuestion } from '@/entities/learning/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/PageState'

type Value = string | number[]

function Question({
  question,
  value,
  setValue,
  locked,
}: {
  question: ReviewQuestion
  value: Value | undefined
  setValue: (value: Value) => void
  locked: boolean
}) {
  if (question.questionType === 'single_choice')
    return (
      <div className="quiz-options">
        {question.options.map((option, index) => (
          <label className={value === String(index) ? 'quiz-option selected-option' : 'quiz-option'} key={option}>
            <input
              type="radio"
              name={question.id}
              checked={value === String(index)}
              disabled={locked}
              onChange={() => setValue(String(index))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    )
  if (question.questionType === 'multiple_choice') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="quiz-options">
        {question.options.map((option, index) => (
          <label className={selected.includes(index) ? 'quiz-option selected-option' : 'quiz-option'} key={option}>
            <input
              type="checkbox"
              checked={selected.includes(index)}
              disabled={locked}
              onChange={() =>
                setValue(selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index])
              }
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    )
  }
  return (
    <input
      type={question.questionType === 'number' ? 'number' : 'text'}
      step={question.questionType === 'number' ? 'any' : undefined}
      maxLength={question.questionType === 'short_text' ? 500 : undefined}
      required
      disabled={locked}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}

export function ReviewSessionPage() {
  const { reviewId = '' } = useParams()
  const client = useQueryClient()
  const [values, setValues] = useState<Record<string, Value>>({})
  const query = useQuery({
    queryKey: ['review-session', reviewId],
    queryFn: () => getReviewSession(reviewId),
    enabled: Boolean(reviewId),
  })
  const submit = useMutation({
    mutationFn: () => {
      const answers = (query.data?.review.questions ?? []).map((question) => {
        const value = values[question.id]
        const answer: QuizAnswer & { questionId: string } = { questionId: question.id }
        if (question.questionType === 'single_choice') answer.selectedOption = Number(value)
        if (question.questionType === 'multiple_choice') answer.selectedOptions = Array.isArray(value) ? value : []
        if (question.questionType === 'number') answer.numberAnswer = Number(value)
        if (question.questionType === 'short_text') answer.textAnswer = String(value ?? '')
        return answer
      })
      return submitReviewSession(reviewId, answers)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['student-mastery'] }),
        client.invalidateQueries({ queryKey: ['student-reviews'] }),
        client.invalidateQueries({ queryKey: ['student-lessons'] }),
      ])
    },
  })
  const review = query.data?.review
  const complete = Boolean(
    review &&
      review.questions.every((question) => {
        const value = values[question.id]
        return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== ''
      }),
  )
  if (query.isLoading) return <LoadingState label="Готовим контрольную…" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!review)
    return (
      <EmptyState title="Повторение недоступно" description="Задание уже выполнено или перенесено родителем.">
        <NavLink className="button-link" to="/progress">
          К прогрессу
        </NavLink>
      </EmptyState>
    )
  return (
    <div className="review-session">
      <header className="page-header">
        <p className="eyebrow" style={{ color: review.subjectColor }}>
          {review.subjectTitle}
        </p>
        <h1>Повторение: {review.topicTitle}</h1>
        <p className="muted">Короткая контрольная из {review.questions.length} вопросов.</p>
      </header>
      <form
        className="review-questions"
        onSubmit={(event) => {
          event.preventDefault()
          submit.mutate()
        }}
      >
        {review.questions.map((question, index) => (
          <article className="card student-quiz" key={question.id}>
            <span className="badge">Вопрос {index + 1}</span>
            <p className="quiz-prompt">{question.prompt}</p>
            <Question
              question={question}
              value={values[question.id]}
              locked={Boolean(submit.data)}
              setValue={(value) => setValues({ ...values, [question.id]: value })}
            />
            {submit.data && (
              <div
                className={
                  submit.data.attempt.results[index]?.correct ? 'quiz-result quiz-correct' : 'quiz-result quiz-wrong'
                }
              >
                {submit.data.attempt.results[index]?.correct ? 'Верно' : 'Нужно повторить'}
                {submit.data.attempt.results[index]?.explanation && (
                  <p>{submit.data.attempt.results[index].explanation}</p>
                )}
              </div>
            )}
          </article>
        ))}
        {!submit.data && <button disabled={!complete || submit.isPending}>Завершить контрольную</button>}
        {submit.data && (
          <section
            className={
              submit.data.attempt.successful ? 'card completion-card' : 'card review-feedback revision-feedback'
            }
          >
            <div>
              <h2>{submit.data.attempt.successful ? 'Повторение пройдено' : 'Попробуй ещё раз'}</h2>
              <p>Результат: {submit.data.attempt.score}%</p>
            </div>
            <NavLink className="button-link" to="/progress">
              К прогрессу
            </NavLink>
          </section>
        )}
        {submit.error && <p className="form-error">{submit.error.message}</p>}
      </form>
    </div>
  )
}
