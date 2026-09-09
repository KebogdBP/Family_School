import { api } from '@/shared/api/client'
import type { Achievement, LessonProgressStatus, MasterySubject, MasteryTopic, PlanItemStatus, ReviewTask } from '@/entities/learning/api'

export type AvailableLesson = { id: string; title: string; subjectTitle: string; subjectColor: string }
export type PlanItem = AvailableLesson & { id: string; lessonId: string; scheduledDate: string; isRequired: boolean; position: number; progressStatus: LessonProgressStatus; planStatus: PlanItemStatus }
export type WeeklyPlan = { weekStart: string; weekEnd: string; availableLessons: AvailableLesson[]; items: PlanItem[] }

export const getWeeklyPlan = (studentId: string, weekStart: string) => api<WeeklyPlan>(`/students/${studentId}/weekly-plan?weekStart=${weekStart}`)
export const addPlanItem = (studentId: string, input: { lessonId: string; scheduledDate: string; isRequired: boolean; position: number }) => api<{ planItem: { id: string } }>(`/students/${studentId}/plan-items`, { method: 'POST', body: JSON.stringify(input) })
export const deletePlanItem = (id: string) => api<{ status: string }>(`/plan-items/${id}`, { method: 'DELETE' })

export type ReviewQuestionSetting = { id: string; title: string; lessonTitle: string; prompt: string; questionType: 'single_choice' | 'multiple_choice' | 'number' | 'short_text' }
export type ReviewQuestionSettings = { mode: 'automatic' | 'custom'; selectedQuestionIds: string[]; questions: ReviewQuestionSetting[] }
export const getReviewQuestionSettings = (studentId: string, topicId: string) => api<ReviewQuestionSettings>(`/students/${studentId}/topics/${topicId}/review-questions`)
export const saveReviewQuestionSettings = (studentId: string, topicId: string, questionIds: string[]) => api<{ mode: 'custom'; selectedQuestionIds: string[] }>(`/students/${studentId}/topics/${topicId}/review-questions`, { method: 'PUT', body: JSON.stringify({ questionIds }) })

export type ProgressReport = {
  summary: { total: number; notStarted: number; inProgress: number; completed: number; needsHelp: number; masteredTopics: number; topicsToReview: number; achievements: number }
  dailyDigest: { date: string; planned: number; assigned: number; inProgress: number; submitted: number; needsRevision: number; reviewed: number; completedLessons: number; needsHelp: number; message: string; attention: Array<{ id: string; lessonId: string; title: string; subjectTitle: string; reasons: string[] }> }
  weeklyDigest: { weekStart: string; weekEnd: string; planned: number; reviewed: number; completedLessons: number; completionPercent: number; masteredTopics: Array<{ id: string; title: string; subjectTitle: string }>; completedReviews: Array<{ id: string; title: string; subjectTitle: string; completedDate: string }>; difficulties: Array<{ id: string; title: string; subjectTitle: string; reason: string }>; suggestions: Array<{ kind: 'lesson' | 'review' | 'topic'; title: string; reason: string }> }
  items: Array<{ id: string; lessonId: string; title: string; subjectTitle: string; subjectColor: string; scheduledDate: string; isRequired: boolean; progressStatus: LessonProgressStatus; planStatus: PlanItemStatus; startedAt: string | null; completedAt: string | null; reflection: { feeling: string; comment: string | null } | null }>
  mastery: MasteryTopic[]
  masterySubjects: MasterySubject[]
  reviewTasks: ReviewTask[]
  achievements: Achievement[]
}
export const getProgressReport = (studentId: string) => api<ProgressReport>(`/students/${studentId}/progress-report`)
