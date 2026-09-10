import { api } from '@/shared/api/client'

export type ReviewSubmission = {
  id: string
  studentName: string
  title: string
  instructions: string
  lessonTitle: string
  subjectTitle: string
  subjectColor: string
  responseText: string
  status: 'submitted' | 'needs_revision' | 'reviewed'
  submittedAt: string
  files: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: number; url: string }>
}
export const getReviewQueue = () => api<{ submissions: ReviewSubmission[] }>('/review-submissions')
export const getReviewSubmissions = getReviewQueue
export const reviewSubmission = (
  id: string,
  input: {
    decision: 'accepted' | 'needs_revision'
    grade: number | null
    comment: string
    independentExplanation: boolean
  },
) => api<{ review: { id: string } }>(`/submissions/${id}/reviews`, { method: 'POST', body: JSON.stringify(input) })
