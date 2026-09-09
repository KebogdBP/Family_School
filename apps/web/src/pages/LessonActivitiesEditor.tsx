import { QuizEditor as QuizSection } from '@/pages/QuizEditor'
import { HomeworkEditor } from '@/pages/HomeworkEditor'

export function QuizEditor({ lessonId }: { lessonId: string }) {
  return <><QuizSection lessonId={lessonId} /><HomeworkEditor lessonId={lessonId} /></>
}
