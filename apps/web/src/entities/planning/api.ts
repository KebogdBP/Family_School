import { api } from '@/shared/api/client'
import type { LessonProgressStatus } from '@/entities/learning/api'

export type AvailableLesson = { id: string; title: string; subjectTitle: string; subjectColor: string }
export type PlanItem = AvailableLesson & { id: string; lessonId: string; scheduledDate: string; isRequired: boolean; position: number; progressStatus: LessonProgressStatus }
export type WeeklyPlan = { weekStart: string; weekEnd: string; availableLessons: AvailableLesson[]; items: PlanItem[] }

export const getWeeklyPlan = (studentId: string, weekStart: string) => api<WeeklyPlan>(`/students/${studentId}/weekly-plan?weekStart=${weekStart}`)
export const addPlanItem = (studentId: string, input: { lessonId: string; scheduledDate: string; isRequired: boolean; position: number }) => api<{ planItem: { id: string } }>(`/students/${studentId}/plan-items`, { method: 'POST', body: JSON.stringify(input) })
export const deletePlanItem = (id: string) => api<{ status: string }>(`/plan-items/${id}`, { method: 'DELETE' })
