import { api } from '@/shared/api/client'

export type CurriculumSummary = { id: string; title: string; schoolYear: string; isActive: boolean }
export type Lesson = { id: string; title: string; summary: string | null; position: number; status: 'draft' | 'published' }
export type Topic = { id: string; title: string; position: number; lessons: Lesson[] }
export type Section = { id: string; title: string; position: number; topics: Topic[] }
export type MasterySettings = { minEvidenceCount: number; minSuccessfulTypes: number; reviewIntervalDays: number }
export type AssignedSubject = { id: string; assignmentId: string; title: string; color: string; position: number; masterySettings: MasterySettings; sections: Section[] }
export type CurriculumTree = { id: string; studentId: string; title: string; schoolYear: string; subjects: AssignedSubject[] }
export type Subject = { id: string; title: string; description: string | null; color: string; isCustom: boolean }
export type BlockType = 'markdown' | 'example' | 'link' | 'video' | 'image'
export type LessonBlock = { id: string; blockType: BlockType; content: { text?: string; url?: string; caption?: string }; position: number }
export type LessonContent = { id: string; title: string; summary: string | null; estimatedMinutes: number | null; status: 'draft' | 'published'; blocks: LessonBlock[] }
export type QuestionType = 'single_choice' | 'multiple_choice' | 'number' | 'short_text'
export type ParentQuiz = { id: string; title: string; question: { id: string; prompt: string; questionType: QuestionType; options: string[]; correctAnswer: { options?: number[]; value?: number; tolerance?: number; accepted?: string[] }; explanation: string | null } }
export type CreateQuizInput = { title: string; prompt: string; questionType: QuestionType; options?: string[]; correctOptions?: number[]; correctNumber?: number; tolerance?: number; acceptedAnswers?: string[]; explanation: string; position: number }
export type Homework = { id: string; title: string; instructions: string; position: number }

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
export const updateMasterySettings = (assignmentId: string, settings: MasterySettings) => api<{ settings: MasterySettings }>(`/curriculum-subjects/${assignmentId}/mastery-settings`, { method: 'PATCH', body: JSON.stringify(settings) })
export const createSection = (assignmentId: string, title: string, position: number) =>
  api(`/curriculum-subjects/${assignmentId}/sections`, { method: 'POST', body: JSON.stringify({ title, position }) })
export const createTopic = (sectionId: string, title: string, position: number) =>
  api(`/sections/${sectionId}/topics`, { method: 'POST', body: JSON.stringify({ title, position }) })
export const createLesson = (topicId: string, title: string, position: number) =>
  api(`/topics/${topicId}/lessons`, { method: 'POST', body: JSON.stringify({ title, position }) })

export type CurriculumNodeType = 'sections' | 'topics' | 'lessons'

export const updateCurriculumNode = (
  type: CurriculumNodeType,
  id: string,
  input: { title: string; position: number; description?: string; summary?: string },
) => api<{ status: string }>(`/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(input) })

export const deleteCurriculumNode = (type: CurriculumNodeType, id: string) =>
  api<{ status: string }>(`/${type}/${id}`, { method: 'DELETE' })

export const getLessonContent = (lessonId: string) =>
  api<{ lesson: LessonContent }>(`/lessons/${lessonId}/content`)

export const createLessonBlock = (lessonId: string, input: { blockType: BlockType; content: LessonBlock['content']; position: number }) =>
  api<{ block: LessonBlock }>(`/lessons/${lessonId}/blocks`, { method: 'POST', body: JSON.stringify(input) })

export const updateLessonBlock = (blockId: string, input: { blockType: BlockType; content: LessonBlock['content']; position: number }) =>
  api<{ status: string }>(`/content-blocks/${blockId}`, { method: 'PATCH', body: JSON.stringify(input) })

export const deleteLessonBlock = (blockId: string) =>
  api<{ status: string }>(`/content-blocks/${blockId}`, { method: 'DELETE' })
export const getLessonQuizzes = (lessonId: string) => api<{ quizzes: ParentQuiz[] }>(`/lessons/${lessonId}/quizzes`)
export const createQuiz = (lessonId: string, input: CreateQuizInput) => api<{ quiz: { id: string } }>(`/lessons/${lessonId}/quizzes`, { method: 'POST', body: JSON.stringify(input) })
export const deleteQuiz = (quizId: string) => api<{ status: string }>(`/quizzes/${quizId}`, { method: 'DELETE' })
export const getLessonHomeworks = (lessonId: string) => api<{ homeworks: Homework[] }>(`/lessons/${lessonId}/homeworks`)
export const createHomework = (lessonId: string, input: { title: string; instructions: string; position: number }) => api<{ homework: { id: string } }>(`/lessons/${lessonId}/homeworks`, { method: 'POST', body: JSON.stringify(input) })
export const deleteHomework = (id: string) => api<{ status: string }>(`/homeworks/${id}`, { method: 'DELETE' })
