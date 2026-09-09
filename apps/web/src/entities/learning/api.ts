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
export type QuestionType = 'single_choice' | 'multiple_choice' | 'number' | 'short_text'
export type StudentQuiz = { id: string; title: string; question: { id: string; prompt: string; questionType: QuestionType; options: string[] } }
export type SubmissionFile = { id: string; originalName: string; mimeType: string; sizeBytes: number; url: string }
export type StudentHomework = { id: string; title: string; instructions: string; submission: null | { id: string; responseText: string; status: 'draft' | 'submitted' | 'needs_revision' | 'reviewed'; reviewComment: string | null; reviewGrade: number | null; files: SubmissionFile[] } }
export type StudentLesson = StudentLessonSummary & { blocks: LessonBlock[]; quizzes: StudentQuiz[]; homeworks: StudentHomework[]; reflection: Reflection | null }
export type TodayLesson = StudentLessonSummary & { planItemId: string; isRequired: boolean }
export type MasteryTopic = { id: string; title: string; sectionTitle: string; subjectTitle: string; subjectColor: string; status: 'available' | 'learning' | 'needs_reinforcement' | 'mastered'; score: number; evidenceCount: number; successfulCount: number; nextReviewAt: string | null; evidence: string[] }
export type Achievement = { id: string; code: 'independent_revision' | 'durable_mastery'; title: string; description: string; earnedAt: string }

export const getStudentLessons = () => api<{ lessons: StudentLessonSummary[] }>('/student/lessons')
export const getTodayLessons = () => api<{ date: string; lessons: TodayLesson[] }>('/student/today')
export const getStudentMastery = () => api<{ topics: MasteryTopic[] }>('/student/mastery')
export const getStudentAchievements = () => api<{ achievements: Achievement[] }>('/student/achievements')
export const getStudentLesson = (lessonId: string) => api<{ lesson: StudentLesson }>(`/student/lessons/${lessonId}`)
export const saveLessonProgress = (lessonId: string, lastBlockPosition: number, completed = false) =>
  api<{ progress: Progress }>(`/student/lessons/${lessonId}/progress`, {
    method: 'PATCH', body: JSON.stringify({ lastBlockPosition, completed }),
  })
export const saveReflection = (lessonId: string, feeling: ReflectionFeeling, comment: string) =>
  api<{ reflection: Reflection }>(`/student/lessons/${lessonId}/reflection`, { method: 'POST', body: JSON.stringify({ feeling, comment }) })
export type QuizAnswer = { selectedOption?: number; selectedOptions?: number[]; numberAnswer?: number; textAnswer?: string }
export const submitQuizAttempt = (quizId: string, answer: QuizAnswer) => api<{ attempt: { id: string; correct: boolean; score: number; explanation: string | null } }>(`/student/quizzes/${quizId}/attempts`, { method: 'POST', body: JSON.stringify(answer) })
export const saveHomeworkSubmission = (homeworkId: string, responseText: string, submit: boolean) => api<{ submission: StudentHomework['submission'] }>(`/student/homeworks/${homeworkId}/submission`, { method: 'PUT', body: JSON.stringify({ responseText, submit }) })
export const uploadHomeworkFile = (homeworkId: string, file: File) => { const body=new FormData();body.set('file',file);return api<{file:SubmissionFile}>(`/student/homeworks/${homeworkId}/files`,{method:'POST',body}) }
export const deleteHomeworkFile = (fileId: string) => api<{status:string}>(`/submission-files/${fileId}`,{method:'DELETE'})
