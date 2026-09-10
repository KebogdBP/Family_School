import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createHomework, deleteHomework, getLessonHomeworks } from '@/entities/curriculum/api'

export function HomeworkEditor({ lessonId }: { lessonId: string }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('Домашняя работа')
  const [instructions, setInstructions] = useState('')
  const items = useQuery({ queryKey: ['lesson-homeworks', lessonId], queryFn: () => getLessonHomeworks(lessonId) })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['lesson-homeworks', lessonId] })
  }
  const create = useMutation({
    mutationFn: () => createHomework(lessonId, { title, instructions, position: items.data?.homeworks.length ?? 0 }),
    onSuccess: async () => {
      setOpen(false)
      setTitle('Домашняя работа')
      setInstructions('')
      await refresh()
    },
  })
  const remove = useMutation({ mutationFn: deleteHomework, onSuccess: refresh })
  return (
    <section className="homework-editor">
      <div className="lesson-toolbar card">
        <div>
          <h2>Домашние задания</h2>
          <p className="muted">Ребёнок отправит текстовый ответ на проверку.</p>
        </div>
        <button onClick={() => setOpen((value) => !value)}>{open ? 'Закрыть' : '+ Добавить задание'}</button>
      </div>
      {open && (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <label className="field">
            <span>Название</span>
            <input required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Условие</span>
            <textarea
              required
              rows={5}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </label>
          {create.error && <p className="form-error">{create.error.message}</p>}
          <button disabled={create.isPending}>Сохранить задание</button>
        </form>
      )}
      <div className="homework-list">
        {items.data?.homeworks.map((item) => (
          <article className="card" key={item.id}>
            <div className="lesson-card-heading">
              <span className="badge">Задание</span>
              <button
                className="icon-button icon-danger"
                aria-label={`Удалить ${item.title}`}
                onClick={() => remove.mutate(item.id)}
              >
                ×
              </button>
            </div>
            <h3>{item.title}</h3>
            <p>{item.instructions}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
