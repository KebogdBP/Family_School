import { api } from '@/shared/api/client'
import type { LessonBlock } from '@/entities/curriculum/api'

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type PlanItemStatus = 'assigned' | 'in_progress' | 'submitted' | 'needs_revision' | 'reviewed'
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
export type TodayLesson = StudentLessonSummary & { planItemId: string; isRequired: boolean; planStatus: PlanItemStatus }
export type ContinueLesson = StudentLessonSummary & { lastActivityAt: string }
export type ReviewTask = { id: string; topicId: string; topicTitle: string; subjectTitle: string; subjectColor: string; lessonId: string | null; dueDate: string; reason: string; isDue: boolean }
export type ReviewQuestion = { id: string; prompt: string; questionType: QuestionType; options: string[] }
export type MasteryTopic = { id: string; title: string; sectionTitle: string; subjectTitle: string; subjectColor: string; status: 'available' | 'learning' | 'needs_reinforcement' | 'mastered'; score: number; evidenceCount: number; successfulCount: number; nextReviewAt: string | null; evidence: string[] }
export type MasterySubject = { id: string; title: string; color: string; topicCount: number; masteredCount: number; reviewCount: number; score: number }
export type Achievement = { id: string; code: 'independent_revision' | 'independent_explanation' | 'durable_mastery'; title: string; description: string; earnedAt: string }
export type DiagnosticResult = { score: number; recommendedTopicId: string; recommendedTopicTitle: string; recommendedLessonId: string; recommendedLessonTitle: string; completedAt: string }
export type Diagnostic = { available: boolean; completed: boolean; routeTitle?: string; questions?: Array<{ id: string; prompt: string; options: string[] }>; result?: DiagnosticResult | null }

export const getStudentLessons = () => api<{ lessons: StudentLessonSummary[] }>('/student/lessons')
export const getTodayLessons = () => api<{ date: string; lessons: TodayLesson[]; continueLesson: ContinueLesson | null; reviewTasks: ReviewTask[] }>('/student/today')
export const getStudentMastery = () => api<{ subjects: MasterySubject[]; topics: MasteryTopic[] }>('/student/mastery')
export const getStudentAchievements = () => api<{ achievements: Achievement[] }>('/student/achievements')
export const getDiagnostic = () => api<Diagnostic>('/student/diagnostic')
export const submitDiagnostic = (answers: number[]) => api<{ completed: boolean; result: DiagnosticResult }>('/student/diagnostic', { method: 'POST', body: JSON.stringify({ answers }) })
export const getStudentReviewTasks = () => api<{ reviewTasks: ReviewTask[] }>('/student/reviews')
export const getReviewSession = (id: string) => api<{ review: { id: string; topicTitle: string; subjectTitle: string; subjectColor: string; dueDate: string; questions: ReviewQuestion[] } }>(`/student/reviews/${id}`)
export const submitReviewSession = (id: string, answers: Array<QuizAnswer & { questionId: string }>) => api<{ attempt: { id: string; score: number; successful: boolean; results: Array<{ questionId: string; correct: boolean; explanation: string | null }> } }>(`/student/reviews/${id}`, { method: 'POST', body: JSON.stringify({ answers }) })
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
export const requestAiHint = (lessonId: string, question: string) => api<{ hint: string; provider: string; safety: 'no_direct_answer' }>(`/student/lessons/${lessonId}/ai-hints`, { method: 'POST', body: JSON.stringify({ question }) })
