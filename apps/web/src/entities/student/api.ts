import { api } from '@/shared/api/client'

export type Student = {
  id: string
  displayName: string
  grade: number
  age: number | null
  avatarColor: string
  isActive: boolean
}

export function getStudents() {
  return api<{ students: Student[] }>('/students')
}

export function createStudent(input: {
  displayName: string
  grade: number
  age?: number
  pin: string
}) {
  return api<{ student: Pick<Student, 'id' | 'displayName' | 'grade'> }>('/students', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteStudent(studentId: string, password: string, confirmation: string) {
  return api<{ status: 'deleted'; deletedFiles: number; fileDeleteFailures: number }>(`/students/${studentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ password, confirmation }),
  })
}
