import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { getDiagnostic, submitDiagnostic, type DiagnosticResult } from '@/entities/learning/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/PageState'

function Result({ result }: { result: DiagnosticResult }) {
  return (
    <section className="card diagnostic-result">
      <span className="diagnostic-score">{result.score}%</span>
      <div>
        <p className="eyebrow">Рекомендуемый первый шаг</p>
        <h2>{result.recommendedTopicTitle}</h2>
        <p>
          Начни с урока «{result.recommendedLessonTitle}». Это не оценка: результат нужен, чтобы подобрать удобную точку
          старта.
        </p>
        <NavLink className="button-link" to={`/study/lessons/${result.recommendedLessonId}`}>
          Перейти к уроку →
        </NavLink>
      </div>
    </section>
  )
}

export function DiagnosticPage() {
  const client = useQueryClient()
  const diagnostic = useQuery({ queryKey: ['student-diagnostic'], queryFn: getDiagnostic })
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const questions = diagnostic.data?.questions ?? []
  const submit = useMutation({
    mutationFn: () => submitDiagnostic(questions.map((question) => answers[question.id])),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['student-diagnostic'] }),
        client.invalidateQueries({ queryKey: ['student-mastery'] }),
      ])
    },
  })
  const result = submit.data?.result ?? diagnostic.data?.result
  if (diagnostic.isLoading) return <LoadingState label="Готовим вопросы…" />
  if (diagnostic.error) return <ErrorState error={diagnostic.error} onRetry={() => void diagnostic.refetch()} />
  if (!diagnostic.data?.available)
    return (
      <EmptyState
        title="Диагностика пока недоступна"
        description="Попроси родителя добавить учебный маршрут в твою программу."
      />
    )
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Старт маршрута</p>
        <h1>{diagnostic.data.routeTitle}</h1>
        <p className="muted">4 коротких вопроса без таймера. Можно спокойно подумать.</p>
      </header>
      {result ? (
        <Result result={result} />
      ) : (
        <form
          className="diagnostic-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit.mutate()
          }}
        >
          {questions.map((question, index) => (
            <fieldset className="card diagnostic-question" key={question.id}>
              <legend>
                <span>{index + 1}</span>
                {question.prompt}
              </legend>
              {question.options.map((option, optionIndex) => (
                <label
                  className={answers[question.id] === optionIndex ? 'diagnostic-option selected' : 'diagnostic-option'}
                  key={option}
                >
                  <input
                    type="radio"
                    name={question.id}
                    required
                    checked={answers[question.id] === optionIndex}
                    onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <button disabled={submit.isPending || Object.keys(answers).length !== questions.length}>
            {submit.isPending ? 'Проверяем…' : 'Завершить диагностику'}
          </button>
          {submit.error && <p className="form-error">{submit.error.message}</p>}
        </form>
      )}
    </>
  )
}
