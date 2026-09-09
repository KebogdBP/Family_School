import { api } from '@/shared/api/client'
import type { Achievement, LessonProgressStatus, MasterySubject, MasteryTopic, ReviewTask } from '@/entities/learning/api'

export type AvailableLesson = { id: string; title: string; subjectTitle: string; subjectColor: string }
export type PlanItem = AvailableLesson & { id: string; lessonId: string; scheduledDate: string; isRequired: boolean; position: number; progressStatus: LessonProgressStatus }
export type WeeklyPlan = { weekStart: string; weekEnd: string; availableLessons: AvailableLesson[]; items: PlanItem[] }

export const getWeeklyPlan = (studentId: string, weekStart: string) => api<WeeklyPlan>(`/students/${studentId}/weekly-plan?weekStart=${weekStart}`)
export const addPlanItem = (studentId: string, input: { lessonId: string; scheduledDate: string; isRequired: boolean; position: number }) => api<{ planItem: { id: string } }>(`/students/${studentId}/plan-items`, { method: 'POST', body: JSON.stringify(input) })
export const deletePlanItem = (id: string) => api<{ status: string }>(`/plan-items/${id}`, { method: 'DELETE' })

export type ProgressReport = {
  summary: { total: number; notStarted: number; inProgress: number; completed: number; needsHelp: number; masteredTopics: number; topicsToReview: number; achievements: number }
  items: Array<{ id: string; lessonId: string; title: string; subjectTitle: string; subjectColor: string; scheduledDate: string; isRequired: boolean; progressStatus: LessonProgressStatus; startedAt: string | null; completedAt: string | null; reflection: { feeling: string; comment: string | null } | null }>
  mastery: MasteryTopic[]
  masterySubjects: MasterySubject[]
  reviewTasks: ReviewTask[]
  achievements: Achievement[]
}
export const getProgressReport = (studentId: string) => api<ProgressReport>(`/students/${studentId}/progress-report`)
