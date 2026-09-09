import { api } from '@/shared/api/client'
import type { LessonBlock } from '@/entities/curriculum/api'

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed'
type Progress = { status: LessonProgressStatus; lastBlockPosition: number }
export type StudentLessonSummary = {
  id: string; title: string; summary: string | null; estimatedMinutes: number | null
  subjectTitle: string; subjectColor: string; sectionTitle: string; topicTitle: string
  progress: Progress; blockCount: number
}
export type ReflectionFeeling = 'easy' | 'good' | 'hard' | 'need_help'
export type Reflection = { feeling: ReflectionFeeling; comment: string | null }
export type StudentQuiz = { id: string; title: string; question: { id: string; prompt: string; options: string[] } }
export type StudentHomework = { id: string; title: string; instructions: string; submission: null | { id: string; responseText: string; status: 'draft' | 'submitted' | 'needs_revision' | 'reviewed'; reviewComment: string | null; reviewGrade: number | null } }
export type StudentLesson = StudentLessonSummary & { blocks: LessonBlock[]; quizzes: StudentQuiz[]; homeworks: StudentHomework[]; reflection: Reflection | null }
export type TodayLesson = StudentLessonSummary & { planItemId: string; isRequired: boolean }

export const getStudentLessons = () => api<{ lessons: StudentLessonSummary[] }>('/student/lessons')
export const getTodayLessons = () => api<{ date: string; lessons: TodayLesson[] }>('/student/today')
export const getStudentLesson = (lessonId: string) => api<{ lesson: StudentLesson }>(`/student/lessons/${lessonId}`)
export const saveLessonProgress = (lessonId: string, lastBlockPosition: number, completed = false) =>
  api<{ progress: Progress }>(`/student/lessons/${lessonId}/progress`, {
    method: 'PATCH', body: JSON.stringify({ lastBlockPosition, completed }),
  })
export const saveReflection = (lessonId: string, feeling: ReflectionFeeling, comment: string) =>
  api<{ reflection: Reflection }>(`/student/lessons/${lessonId}/reflection`, { method: 'POST', body: JSON.stringify({ feeling, comment }) })
export const submitQuizAttempt = (quizId: string, selectedOption: number) => api<{ attempt: { id: string; correct: boolean; score: number; explanation: string | null } }>(`/student/quizzes/${quizId}/attempts`, { method: 'POST', body: JSON.stringify({ selectedOption }) })
export const saveHomeworkSubmission = (homeworkId: string, responseText: string, submit: boolean) => api<{ submission: StudentHomework['submission'] }>(`/student/homeworks/${homeworkId}/submission`, { method: 'PUT', body: JSON.stringify({ responseText, submit }) })
