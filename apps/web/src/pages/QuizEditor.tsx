import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createQuiz,
  deleteQuiz,
  getLessonQuizzes,
  type CreateQuizInput,
  type ParentQuiz,
  type QuestionType,
} from '@/entities/curriculum/api'

const typeLabels: Record<QuestionType, string> = {
  single_choice: 'Один вариант',
  multiple_choice: 'Несколько вариантов',
  number: 'Число',
  short_text: 'Короткий текст',
}
const emptyForm = {
  title: 'Мини-тест',
  prompt: '',
  questionType: 'single_choice' as QuestionType,
  options: ['', '', ''],
  correctOptions: [0],
  correctNumber: '',
  tolerance: '0',
  acceptedAnswers: '',
  explanation: '',
}

function CorrectAnswer({ quiz }: { quiz: ParentQuiz }) {
  const answer = quiz.question.correctAnswer
  if (quiz.question.questionType === 'number')
    return (
      <p className="correct-option">
        Ответ: {answer.value} · погрешность {answer.tolerance ?? 0}
      </p>
    )
  if (quiz.question.questionType === 'short_text')
    return <p className="correct-option">Принимается: {answer.accepted?.join(', ')}</p>
  return (
    <ol>
      {quiz.question.options.map((option, index) => (
        <li className={answer.options?.includes(index) ? 'correct-option' : ''} key={`${index}-${option}`}>
          {option}
        </li>
      ))}
    </ol>
  )
}

export function QuizEditor({ lessonId }: { lessonId: string }) {
  const client = useQueryClient()
  const quizzes = useQuery({ queryKey: ['lesson-quizzes', lessonId], queryFn: () => getLessonQuizzes(lessonId) })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['lesson-quizzes', lessonId] })
  }
  const create = useMutation({
    mutationFn: () => {
      const input: CreateQuizInput = {
        title: form.title,
        prompt: form.prompt,
        questionType: form.questionType,
        explanation: form.explanation,
        position: quizzes.data?.quizzes.length ?? 0,
      }
      if (form.questionType === 'single_choice' || form.questionType === 'multiple_choice') {
        input.options = form.options.filter(Boolean)
        input.correctOptions = form.correctOptions
      }
      if (form.questionType === 'number') {
        input.correctNumber = Number(form.correctNumber)
        input.tolerance = Number(form.tolerance)
      }
      if (form.questionType === 'short_text')
        input.acceptedAnswers = form.acceptedAnswers
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean)
      return createQuiz(lessonId, input)
    },
    onSuccess: async () => {
      setOpen(false)
      setForm(emptyForm)
      await refresh()
    },
  })
  const remove = useMutation({ mutationFn: deleteQuiz, onSuccess: refresh })
  const choiceType = form.questionType === 'single_choice' || form.questionType === 'multiple_choice'
  const setCorrect = (index: number) =>
    setForm((current) => ({
      ...current,
      correctOptions:
        current.questionType === 'single_choice'
          ? [index]
          : current.correctOptions.includes(index)
            ? current.correctOptions.filter((value) => value !== index)
            : [...current.correctOptions, index],
    }))

  return (
    <section className="quiz-editor">
      <div className="lesson-toolbar card">
        <div>
          <h2>Проверка знаний</h2>
          <p className="muted">Один, несколько, число или короткий текст.</p>
        </div>
        <button onClick={() => setOpen((value) => !value)}>{open ? 'Закрыть' : '+ Добавить тест'}</button>
      </div>
      {open && (
        <form
          className="card quiz-form"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <div className="form-row">
            <label className="field">
              <span>Название</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Тип ответа</span>
              <select
                value={form.questionType}
                onChange={(event) =>
                  setForm({ ...form, questionType: event.target.value as QuestionType, correctOptions: [0] })
                }
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Вопрос</span>
            <textarea
              required
              rows={3}
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
            />
          </label>
          {choiceType && (
            <div className="choice-builder">
              <strong>Варианты · отметьте правильные</strong>
              {form.options.map((option, index) => (
                <label className="quiz-option" key={index}>
                  <input
                    type={form.questionType === 'single_choice' ? 'radio' : 'checkbox'}
                    name="correct-answer"
                    checked={form.correctOptions.includes(index)}
                    onChange={() => setCorrect(index)}
                  />
                  <input
                    required={index < 2}
                    placeholder={`Вариант ${index + 1}`}
                    value={option}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        options: form.options.map((value, optionIndex) =>
                          optionIndex === index ? event.target.value : value,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {form.questionType === 'number' && (
            <div className="form-row">
              <label className="field">
                <span>Правильное число</span>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.correctNumber}
                  onChange={(event) => setForm({ ...form, correctNumber: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Допустимая погрешность</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={form.tolerance}
                  onChange={(event) => setForm({ ...form, tolerance: event.target.value })}
                />
              </label>
            </div>
          )}
          {form.questionType === 'short_text' && (
            <label className="field">
              <span>Допустимые ответы через запятую или с новой строки</span>
              <textarea
                required
                rows={3}
                placeholder="Москва, город Москва"
                value={form.acceptedAnswers}
                onChange={(event) => setForm({ ...form, acceptedAnswers: event.target.value })}
              />
            </label>
          )}
          <label className="field">
            <span>Объяснение после ответа</span>
            <textarea
              rows={2}
              value={form.explanation}
              onChange={(event) => setForm({ ...form, explanation: event.target.value })}
            />
          </label>
          {create.error && <p className="form-error">{create.error.message}</p>}
          <button disabled={create.isPending}>Сохранить тест</button>
        </form>
      )}
      <div className="quiz-list">
        {quizzes.data?.quizzes.map((quiz) => (
          <article className="card" key={quiz.id}>
            <div className="lesson-card-heading">
              <span className="badge">{typeLabels[quiz.question.questionType]}</span>
              <button
                className="icon-button icon-danger"
                aria-label={`Удалить ${quiz.title}`}
                onClick={() => remove.mutate(quiz.id)}
              >
                ×
              </button>
            </div>
            <h3>{quiz.title}</h3>
            <p>{quiz.question.prompt}</p>
            <CorrectAnswer quiz={quiz} />
          </article>
        ))}
      </div>
    </section>
  )
}
