import { api } from '@/shared/api/client'
import type { Principal } from './model'

export const getMe = () => api<{ principal: Principal }>('/me')

export const loginParent = (input: { email: string; password: string }) =>
  api<{ user: { id: string; role: 'parent'; displayName: string } }>('/auth/parent/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const loginStudent = (input: { studentId: string; pin: string }) =>
  api<{ student: { id: string; role: 'student'; displayName: string; grade: number } }>('/auth/student/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const setupFamily = (input: {
  setupToken: string
  familyName: string
  displayName: string
  email: string
  password: string
}) => {
  const { setupToken, ...body } = input
  return api<{ family: { id: string; name: string } }>('/setup', {
    method: 'POST',
    headers: { 'X-Setup-Token': setupToken },
    body: JSON.stringify(body),
  })
}

export const logout = () => api<{ status: string }>('/auth/logout', { method: 'POST' })

export type FamilyExport = {
  schemaVersion: number
  generatedAt: string
  family: { id: string; name: string }
  data: Record<string, Array<Record<string, unknown>>>
}
export const exportFamilyData = () => api<FamilyExport>('/family/export')
