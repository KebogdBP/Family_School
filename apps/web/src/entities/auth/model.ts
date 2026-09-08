import { create } from 'zustand'

export type Principal = {
  role: 'parent' | 'student'
  familyId: string
  id: string
  displayName: string
  grade: number | null
}

type AuthState = {
  principal: Principal | null
  setPrincipal: (principal: Principal | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  principal: null,
  setPrincipal: (principal) => set({ principal }),
}))

