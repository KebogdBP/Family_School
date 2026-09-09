import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createLessonBlock, deleteLessonBlock, getLessonContent, updateLessonBlock,
  type BlockType, type LessonBlock,
} from '@/entities/curriculum/api'
import { QuizEditor } from '@/pages/QuizEditor'

const blockLabels: Record<BlockType, string> = {
  markdown: 'Текст', example: 'Пример', link: 'Ссылка', video: 'Видео', image: 'Изображение',
}

function ErrorText({ error }: { error: unknown }) {
  return error ? <p className="form-error" role="alert">{error instanceof Error ? error.message : 'Произошла ошибка'}</p> : null
}

function BlockForm({ lessonId, block, nextPosition, onDone }: { lessonId: string; block?: LessonBlock; nextPosition: number; onDone: () => Promise<unknown> }) {
  const [blockType, setBlockType] = useState<BlockType>(block?.blockType ?? 'markdown')
  const [value, setValue] = useState(block?.content.text ?? block?.content.url ?? '')
  const [caption, setCaption] = useState(block?.content.caption ?? '')
  const isText = blockType === 'markdown' || blockType === 'example'
  const mutation = useMutation({
    mutationFn: async () => {
      const content = isText ? { text: value } : { url: value, ...(caption ? { caption } : {}) }
      const input = { blockType, content, position: block?.position ?? nextPosition }
      if (block) await updateLessonBlock(block.id, input)
      else await createLessonBlock(lessonId, input)
    },
    onSuccess: onDone,
  })
  return <form className="block-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><label className="field"><span>Тип блока</span><select value={blockType} onChange={(event) => { setBlockType(event.target.value as BlockType); setValue(''); setCaption('') }}>{Object.entries(blockLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="field block-value"><span>{isText ? 'Содержимое' : 'URL'}</span>{isText ? <textarea required rows={blockType === 'markdown' ? 8 : 5} placeholder={blockType === 'markdown' ? 'Объяснение темы. Можно использовать Markdown.' : 'Разберите пример по шагам.'} value={value} onChange={(event) => setValue(event.target.value)} /> : <input type="url" required placeholder="https://…" value={value} onChange={(event) => setValue(event.target.value)} />}</label>{!isText && <label className="field"><span>Подпись (необязательно)</span><input maxLength={300} value={caption} onChange={(event) => setCaption(event.target.value)} /></label>}<ErrorText error={mutation.error} /><div className="form-actions"><button disabled={mutation.isPending}>{block ? 'Сохранить' : 'Добавить блок'}</button></div></form>
}

function BlockCard({ block, index, siblings, onChanged }: { block: LessonBlock; index: number; siblings: LessonBlock[]; onChanged: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const reorder = useMutation({ mutationFn: async (targetIndex: number) => {
    const target = siblings[targetIndex]
    if (!target) return
    await updateLessonBlock(target.id, { blockType: target.blockType, content: target.content, position: block.position })
    await updateLessonBlock(block.id, { blockType: block.blockType, content: block.content, position: target.position })
  }, onSuccess: onChanged })
  const remove = useMutation({ mutationFn: () => deleteLessonBlock(block.id), onSuccess: onChanged })
  if (editing) return <article className="block-card card"><BlockForm lessonId="" block={block} nextPosition={block.position} onDone={async () => { setEditing(false); await onChanged() }} /><button className="button-ghost" onClick={() => setEditing(false)}>Отмена</button></article>
  const source = block.content.text ?? block.content.url ?? ''
  return <article className="block-card card"><header><span className="badge">{blockLabels[block.blockType]}</span><div className="block-actions"><button className="icon-button" disabled={index === 0 || reorder.isPending} aria-label="Переместить выше" onClick={() => reorder.mutate(index - 1)}>↑</button><button className="icon-button" disabled={index === siblings.length - 1 || reorder.isPending} aria-label="Переместить ниже" onClick={() => reorder.mutate(index + 1)}>↓</button><button className="icon-button" aria-label="Редактировать блок" onClick={() => setEditing(true)}>✎</button><button className="icon-button icon-danger" aria-label="Удалить блок" onClick={() => setConfirming(true)}>×</button></div></header>{block.blockType === 'markdown' || block.blockType === 'example' ? <p className="block-preview">{source}</p> : <><a className="content-link" href={source} target="_blank" rel="noreferrer">{source}</a>{block.content.caption && <p className="muted">{block.content.caption}</p>}</>}{confirming && <div className="delete-confirm"><span>Удалить этот блок?</span><button className="button-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Да, удалить</button><button className="button-ghost" onClick={() => setConfirming(false)}>Отмена</button><ErrorText error={remove.error} /></div>}<ErrorText error={reorder.error} /></article>
}

export function LessonEditorPage() {
  const { lessonId = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const lesson = useQuery({ queryKey: ['lesson-content', lessonId], queryFn: () => getLessonContent(lessonId), enabled: Boolean(lessonId) })
  const [adding, setAdding] = useState(false)
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['lesson-content', lessonId] }) }
  const blocks = lesson.data?.lesson.blocks ?? []
  return <><header className="page-header"><p className="eyebrow">Редактор урока</p><div className="header-row"><div><h1>{lesson.data?.lesson.title ?? 'Урок'}</h1><p className="muted">Соберите материал из простых блоков и расположите их в нужном порядке.</p></div><button className="button-ghost" onClick={() => void navigate(-1)}>← Назад к программе</button></div></header><ErrorText error={lesson.error} />{lesson.isLoading ? <p>Загружаем урок…</p> : <><section className="lesson-toolbar card"><div><h2>Содержание</h2><p className="muted">{blocks.length ? `Блоков: ${blocks.length}` : 'Урок пока пуст'}</p></div><button onClick={() => setAdding((value) => !value)}>{adding ? 'Закрыть' : '+ Добавить блок'}</button></section>{adding && <section className="card editor-panel"><BlockForm lessonId={lessonId} nextPosition={blocks.length} onDone={async () => { setAdding(false); await refresh() }} /></section>}<section className="blocks-list">{blocks.map((block, index) => <BlockCard key={block.id} block={block} index={index} siblings={blocks} onChanged={refresh} />)}{blocks.length === 0 && !adding && <div className="card empty"><h2>Добавьте объяснение</h2><p className="muted">Начните с текстового блока, затем добавьте пример или полезное видео.</p></div>}</section><QuizEditor lessonId={lessonId} /></>}</>
}
