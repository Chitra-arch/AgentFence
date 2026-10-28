import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, setToken } from './api'

type Ctx = { authed: boolean; login: (t: string) => void; logout: () => void; wsId: string | null; setWsId: (id: string) => void }
const C = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [wsId, setWsId] = useState<string | null>(null)
  const qc = useQueryClient()
  const login = useCallback((t: string) => { setToken(t); setAuthed(true) }, [])
  const logout = useCallback(() => { setToken(null); setAuthed(false); setWsId(null); qc.clear() }, [qc])
  return <C.Provider value={{ authed, login, logout, wsId, setWsId }}>{children}</C.Provider>
}

export function useAuth(): Ctx {
  const c = useContext(C)
  if (!c) throw new Error('AuthProvider missing')
  return c
}

export function useWs() {
  const { wsId, setWsId, authed } = useAuth()
  const query = useQuery({ queryKey: ['workspaces'], queryFn: api.workspaces, enabled: authed })
  const list = query.data ?? []
  const current = list.find((w) => w.id === wsId) ?? list[0]
  return { wsId: current?.id, current, workspaces: list, setWsId, query }
}
