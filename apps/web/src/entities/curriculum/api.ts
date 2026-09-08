import { api } from '@/shared/api/client'

export type CurriculumSummary = { id: string; title: string; schoolYear: string; isActive: boolean }
export type Lesson = { id: string; title: string; summary: string | null; position: number; status: 'draft' | 'published' }
export type Topic = { id: string; title: string; position: number; lessons: Lesson[] }
export type Section = { id: string; title: string; position: number; topics: Topic[] }
export type AssignedSubject = { id: string; assignmentId: string; title: string; color: string; position: number; sections: Section[] }
export type CurriculumTree = { id: string; studentId: string; title: string; schoolYear: string; subjects: AssignedSubject[] }
export type Subject = { id: string; title: string; description: string | null; color: string; isCustom: boolean }

export const getSubjects = () => api<{ subjects: Subject[] }>('/subjects')
export const createSubject = (input: { title: string; color?: string }) =>
  api<{ subject: Subject }>('/subjects', { method: 'POST', body: JSON.stringify(input) })
export const getCurricula = (studentId: string) =>
  api<{ curricula: CurriculumSummary[] }>(`/students/${studentId}/curricula`)
export const createCurriculum = (input: { studentId: string; title: string; schoolYear: string }) =>
  api<{ curriculum: CurriculumSummary & { studentId: string } }>('/curricula', { method: 'POST', body: JSON.stringify(input) })
export const getCurriculum = (id: string) => api<{ curriculum: CurriculumTree }>(`/curricula/${id}`)
export const attachSubject = (curriculumId: string, subjectId: string, position: number) =>
  api<{ curriculumSubject: { id: string } }>(`/curricula/${curriculumId}/subjects`, { method: 'POST', body: JSON.stringify({ subjectId, position }) })
export const createSection = (assignmentId: string, title: string, position: number) =>
  api(`/curriculum-subjects/${assignmentId}/sections`, { method: 'POST', body: JSON.stringify({ title, position }) })
export const createTopic = (sectionId: string, title: string, position: number) =>
  api(`/sections/${sectionId}/topics`, { method: 'POST', body: JSON.stringify({ title, position }) })
export const createLesson = (topicId: string, title: string, position: number) =>
  api(`/topics/${topicId}/lessons`, { method: 'POST', body: JSON.stringify({ title, position }) })
