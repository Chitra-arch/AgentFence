import { createContext, useCallback, useContext, useEffect, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import type { Decision } from './api'

const ring = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber'
const press = 'transition duration-150 active:scale-[.98]'
export const btn = `inline-flex items-center gap-2 rounded-md border border-brown bg-panel px-3 py-1.5 text-sm hover:border-amber hover:text-amber disabled:cursor-not-allowed disabled:opacity-50 ${press} ${ring}`
export const btnPrimary = `sheen inline-flex items-center gap-2 rounded-md border border-amber bg-amber px-3 py-1.5 text-sm font-medium text-ink hover:bg-amber/90 disabled:cursor-not-allowed disabled:opacity-50 ${press} ${ring}`
export const input = `w-full rounded-md border border-brown/70 bg-ink px-3 py-1.5 text-sm transition-colors placeholder:text-muted hover:border-brown focus:border-amber ${ring}`
export const card = 'rounded-lg border border-brown/50 bg-panel shadow-[inset_0_1px_0_rgba(237,229,216,.04)]'
export const glowMove = (e: RPointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}
export const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—')

export const Logo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" /><path d="M9 8v6M12 8v8M15 8v6" /></svg>)

export const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>)

export const Loading = () => (
  <div role="status" className="space-y-3"><div className="skeleton h-8 w-1/3" /><div className="skeleton h-24" /><div className="skeleton h-24" /><span className="sr-only">Loading…</span></div>)

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div role="alert" className="page-enter rounded-lg border border-danger/60 p-4 text-sm">
    <p className="text-danger">{error instanceof Error ? error.message : 'Something went wrong'}</p>
    {retry && <button className={`${btn} mt-3`} onClick={retry}>Retry</button>}
  </div>
}

export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return <div className={`${card} page-enter p-10 text-center`}>
    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-brown/60 text-amber">{icon ?? <Inbox size={20} aria-hidden />}</div>
    <h3 className="font-medium">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p><div className="mt-4">{action}</div></div>
}

const label: Record<Decision, string> = { ALLOW: 'Allowed', DENY: 'Denied', FAILED: 'Failed' }
const tone: Record<Decision, string> = { ALLOW: 'border-amber/70 bg-amber/10 text-amber', DENY: 'border-danger/70 bg-danger/10 text-danger', FAILED: 'border-muted/70 bg-muted/10 text-muted' }
// Text label + glyph, so status never depends on color alone.
export const Badge = ({ d }: { d: Decision }) =>
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone[d]}`}>{d === 'ALLOW' ? '✓' : d === 'DENY' ? '✕' : '!'} {label[d]}</span>

export function useCountUp(target?: number, ms = 700) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (target == null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function Stat({ label: l, value }: { label: string; value?: number }) {
  const v = useCountUp(value)
  return <div onPointerMove={glowMove} className={`${card} glow lift p-4`}><p className="text-sm text-muted">{l}</p>
    {value == null ? <div className="skeleton mt-2 h-9 w-16" /> : <p className="mt-1 text-3xl font-semibold tabular-nums">{v}</p>}</div>
}

export function SplitBar({ a, d, f }: { a: number; d: number; f: number }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) }, [])
  const t = a + d + f || 1
  const w = (n: number) => (on ? `${(n / t) * 100}%` : '0%')
  const seg = 'transition-[width] duration-700 ease-out'
  return <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink" role="img" aria-label={`${a} allowed, ${d} denied, ${f} failed`}>
    <div className={`${seg} bg-amber`} style={{ width: w(a) }} /><div className={`${seg} bg-danger`} style={{ width: w(d) }} /><div className={`${seg} bg-muted`} style={{ width: w(f) }} /></div>
}

type Toast = { id: number; m: string; err: boolean; out: boolean }
const T = createContext<(m: string, err?: boolean) => void>(() => {})
export const useToast = () => useContext(T)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<Toast[]>([])
  const push = useCallback((m: string, err = false) => {
    const id = Math.random(); set((i) => [...i, { id, m, err, out: false }])
    setTimeout(() => set((i) => i.map((x) => (x.id === id ? { ...x, out: true } : x))), 3600)
    setTimeout(() => set((i) => i.filter((x) => x.id !== id)), 4000)
  }, [])
  return <T.Provider value={push}>{children}
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((t) => <div key={t.id} className={`${t.out ? 'toast-out' : 'toast'} rounded-md border bg-panel px-4 py-2 text-sm shadow-lg ${t.err ? 'border-danger' : 'border-amber'}`}>{t.m}</div>)}
    </div></T.Provider>
}
