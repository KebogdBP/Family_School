import { api } from '@/shared/api/client'
import type { LessonBlock } from '@/entities/curriculum/api'

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed'
type Progress = { status: LessonProgressStatus; lastBlockPosition: number }
export type StudentLessonSummary = {
  id: string; title: string; summary: string | null; estimatedMinutes: number | null
  subjectTitle: string; subjectColor: string; sectionTitle: string; topicTitle: string
  progress: Progress; blockCount: number
}
export type StudentLesson = StudentLessonSummary & { blocks: LessonBlock[] }

export const getStudentLessons = () => api<{ lessons: StudentLessonSummary[] }>('/student/lessons')
export const getStudentLesson = (lessonId: string) => api<{ lesson: StudentLesson }>(`/student/lessons/${lessonId}`)
export const saveLessonProgress = (lessonId: string, lastBlockPosition: number, completed = false) =>
  api<{ progress: Progress }>(`/student/lessons/${lessonId}/progress`, {
    method: 'PATCH', body: JSON.stringify({ lastBlockPosition, completed }),
  })
