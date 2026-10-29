import { useEffect, useState, type ReactNode } from 'react'
import type { DayPoint } from './api'
import { card, glowMove, useCountUp } from './ui'

export const COLORS = { allowed: '#B99D73', denied: '#D17A62', failed: '#A39580' }

function useMounted() {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) }, [])
  return on
}

export function Panel({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return <section className={`${card} p-4 ${className}`}>
    <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="font-medium">{title}</h2>{hint && <span className="text-xs text-muted">{hint}</span>}</div>{children}</section>
}

export const NoData = ({ days }: { days: number }) =>
  <p className="py-10 text-center text-sm text-muted">No actions recorded in the last {days} days. Run a scenario to see data here.</p>

export function Kpi({ label, value, suffix = '', hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  const v = useCountUp(value)
  return <div onPointerMove={glowMove} className={`${card} glow lift p-4`}><p className="text-sm text-muted">{label}</p>
    <p className="mt-1 text-3xl font-semibold tabular-nums">{v}{suffix}</p>{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}</div>
}

export function Legend() {
  return <ul className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
    {(['allowed', 'denied', 'failed'] as const).map((k) => <li key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COLORS[k] }} />{k[0].toUpperCase() + k.slice(1)}</li>)}</ul>
}

/** Daily stacked columns (allowed / denied / failed) with hover + keyboard focus details. */
export function StackedBars({ data }: { data: DayPoint[] }) {
  const on = useMounted(); const [hv, setHv] = useState<number | null>(null)
  const W = 640, H = 230, L = 34, R = 6, T = 8, B = 26
  const peak = Math.max(0, ...data.map((d) => d.allowed + d.denied + d.failed))
  const top = Math.max(4, Math.ceil(peak / 4) * 4)
  const bw = (W - L - R) / data.length, bar = Math.min(34, bw * 0.64)
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const step = Math.ceil(data.length / 7)
  const fd = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const sel = hv == null ? null : data[hv]
  return <div>
    <p className="mb-2 h-5 text-sm text-muted" aria-live="polite">{sel ? `${fd(sel.date)} — ${sel.allowed} allowed · ${sel.denied} denied · ${sel.failed} failed` : 'Hover or focus a day for details (UTC days)'}</p>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={`Daily decisions over ${data.length} days`}>
      {[0, 1, 2, 3, 4].map((i) => { const v = (top / 4) * i
        return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#6C5636" strokeOpacity=".3" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#A39580">{v}</text></g> })}
      {data.map((d, i) => {
        const x = L + i * bw + (bw - bar) / 2; let acc = 0
        const seg = (v: number, color: string, k: string) => {
          const y1 = y(acc + v), y0 = y(acc); acc += v
          return v > 0 ? <rect key={k} x={x} y={y1} width={bar} height={y0 - y1} fill={color} rx="2" opacity={hv == null || hv === i ? 1 : 0.45}
            style={{ transformOrigin: 'bottom', transformBox: 'fill-box', transform: on ? 'scaleY(1)' : 'scaleY(0)', transition: `transform .6s cubic-bezier(.22,1,.36,1) ${i * 25}ms, opacity .2s` }} /> : null
        }
        return <g key={d.date}>
          {seg(d.allowed, COLORS.allowed, 'a')}{seg(d.denied, COLORS.denied, 'd')}{seg(d.failed, COLORS.failed, 'f')}
          {i % step === 0 && <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#A39580">{fd(d.date)}</text>}
          <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" tabIndex={0} style={{ outline: 'none' }}
            aria-label={`${fd(d.date)}: ${d.allowed} allowed, ${d.denied} denied, ${d.failed} failed`}
            onPointerEnter={() => setHv(i)} onPointerLeave={() => setHv(null)} onFocus={() => setHv(i)} onBlur={() => setHv(null)} /></g>
      })}
    </svg><Legend /></div>
}

export function Donut({ allowed, denied, failed }: { allowed: number; denied: number; failed: number }) {
  const on = useMounted(); const total = allowed + denied + failed
  const r = 52, c = 2 * Math.PI * r
  const parts = [['Allowed', allowed, COLORS.allowed], ['Denied', denied, COLORS.denied], ['Failed', failed, COLORS.failed]] as const
  let off = 0
  return <div className="flex flex-col items-center gap-4">
    <svg viewBox="0 0 140 140" className="w-40" role="img" aria-label={`${allowed} allowed, ${denied} denied, ${failed} failed`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#6C5636" strokeOpacity=".25" strokeWidth="16" />
      {total > 0 && parts.map(([l, v, col]) => { const len = (c * v) / total; const el = v > 0 ?
        <circle key={l} cx="70" cy="70" r={r} fill="none" stroke={col} strokeWidth="16" transform="rotate(-90 70 70)"
          strokeDasharray={`${on ? Math.max(0, len - 1) : 0} ${c}`} strokeDashoffset={-off} style={{ transition: 'stroke-dasharray .9s cubic-bezier(.22,1,.36,1)' }} /> : null
        off += len; return el })}
      <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="600" fill="#EDE5D8">{total}</text>
      <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#A39580">actions</text></svg>
    <ul className="w-full space-y-1 text-sm">{parts.map(([l, v, col]) => <li key={l} className="flex items-center justify-between">
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} />{l}</span>
      <span className="tabular-nums text-muted">{v} · {total ? Math.round((v / total) * 100) : 0}%</span></li>)}</ul></div>
}

export function ActionBars({ rows }: { rows: { action: string; allowed: number; denied: number; failed: number }[] }) {
  const on = useMounted()
  const max = Math.max(1, ...rows.map((r) => r.allowed + r.denied + r.failed))
  return <div className="space-y-3">{rows.map((r) => { const t = r.allowed + r.denied + r.failed
    return <div key={r.action} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate font-mono text-xs">{r.action}</span>
      <div className="h-2.5 rounded-full bg-ink"><div className="flex h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out" style={{ width: on ? `${(t / max) * 100}%` : '0%' }}>
        {(['allowed', 'denied', 'failed'] as const).map((k) => r[k] > 0 && <div key={k} style={{ flex: `${r[k]} 1 0`, background: COLORS[k] }} />)}</div></div>
      <span className="tabular-nums text-muted">{t}</span></div> })}<Legend /></div>
}
