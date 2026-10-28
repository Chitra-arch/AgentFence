import { useEffect, useRef, useState, type ReactNode } from 'react'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Floating particle network: drifting dots, proximity links, repelled by the pointer. */
export function Particles({ density = 60, interactive = true }: { density?: number; interactive?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const still = reduced(); const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0
    const mouse = { x: -999, y: -999 }
    type P = { x: number; y: number; vx: number; vy: number; r: number; warm: boolean }
    let ps: P[] = []
    const resize = () => {
      const r = c.getBoundingClientRect(); w = r.width; h = r.height
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(density * Math.min(1, (w * h) / (1280 * 720)))
      ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28 - 0.04, r: Math.random() * 1.6 + 0.6, warm: Math.random() < 0.7 }))
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        if (interactive) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy); if (d > 0 && d < 120) { p.x += (dx / d) * 1.3; p.y += (dy / d) * 1.3 } }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.warm ? 'rgba(185,157,115,.85)' : 'rgba(108,86,54,.95)'; ctx.fill()
      }
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j], d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < 115) { ctx.strokeStyle = `rgba(185,157,115,${(1 - d / 115) * 0.22})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
      }
      if (!still) raf = requestAnimationFrame(draw)
    }
    const onMove = (e: PointerEvent) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !still) raf = requestAnimationFrame(draw) }
    resize(); draw()
    window.addEventListener('resize', resize); window.addEventListener('pointermove', onMove); document.addEventListener('visibilitychange', onVis)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis) }
  }, [density, interactive])
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}

export const Aurora = () => <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><div className="aurora a1" /><div className="aurora a2" /></div>

/** Fades and rises into view when scrolled to. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null); const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (reduced() || !('IntersectionObserver' in window)) { setOn(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el); return () => io.disconnect()
  }, [])
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition duration-700 ease-out ${on ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}>{children}</div>
}

/** Illustration: an agent's requests meet the policy gate. Allowed packets pass, denied ones bounce back. */
export function FenceDiagram({ className = '' }: { className?: string }) {
  const amber = '#B99D73', brown = '#6C5636', red = '#D17A62', ink = '#14130f'
  const node = (y: number, label: string, tag: string, lock = false) => (
    <g key={label}><rect x="410" y={y - 22} width="96" height="44" rx="8" fill={ink} stroke={brown} />
      <text x="458" y={y - 3} textAnchor="middle" fill="#EDE5D8" fontSize="12">{label}</text>
      <text x="458" y={y + 13} textAnchor="middle" fill={lock ? red : amber} fontSize="10">{lock ? '🔒 ' : ''}{tag}</text></g>)
  return (
    <svg viewBox="0 0 520 320" className={className} role="img" aria-label="Illustration: an agent sends requests through a policy gate. Public reads pass, confidential reads are blocked.">
      <defs><radialGradient id="gl" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={amber} stopOpacity=".35" /><stop offset="1" stopColor={amber} stopOpacity="0" /></radialGradient></defs>
      <path d="M100 160H250M270 160 L410 90M270 160H410M270 160 L410 230" stroke={brown} strokeDasharray="4 6" fill="none" />
      <circle cx="70" cy="160" r="30" fill={ink} stroke={amber} strokeWidth="1.5" />
      <circle cx="70" cy="160" r="30" fill="none" stroke={amber} opacity=".6"><animate attributeName="r" values="30;46;30" dur="3s" repeatCount="indefinite" /><animate attributeName="opacity" values=".6;0;.6" dur="3s" repeatCount="indefinite" /></circle>
      <text x="70" y="164" textAnchor="middle" fill="#EDE5D8" fontSize="12">Agent</text>
      <circle cx="260" cy="160" r="90" fill="url(#gl)" />
      <rect x="248" y="50" width="24" height="220" rx="10" fill={ink} stroke={amber} strokeWidth="1.5" />
      {[80, 110, 140, 170, 200, 230].map((y) => <line key={y} x1="252" x2="268" y1={y} y2={y} stroke={brown} />)}
      <text x="260" y="296" textAnchor="middle" fill={amber} fontSize="11">POLICY · default deny</text>
      {node(90, 'public doc', 'ALLOW')}{node(160, 'sample records', 'rule-based')}{node(230, 'confidential doc', 'DENY', true)}
      <circle r="6" fill={amber}>
        <animateMotion path="M100 160H260L410 90" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="3s" repeatCount="indefinite" /></circle>
      <circle r="6" fill={red}>
        <animateMotion path="M100 160H246" keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="linear" dur="3s" begin="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="3s" begin="1.5s" repeatCount="indefinite" /></circle>
      <text x="260" y="38" textAnchor="middle" fill={red} fontSize="22" opacity="0">✕
        <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.1;.45;1" dur="3s" begin="3s" repeatCount="indefinite" /></text>
    </svg>)
}

const SAMPLES = [
  { cmd: 'read_document("doc-public-1")', ok: true, why: 'explicit allow: read_document on public' },
  { cmd: 'read_document("doc-conf-1")', ok: false, why: 'default deny: no matching rule' },
  { cmd: 'delete_record("records-sample")', ok: false, why: 'delete_record is always denied in v1' },
]

/** Typewriter loop of example evaluations (illustrative, not live data). */
export function Terminal() {
  const [i, setI] = useState(0); const [n, setN] = useState(0)
  const cur = SAMPLES[i % SAMPLES.length]; const done = n >= cur.cmd.length
  useEffect(() => {
    if (reduced()) { setN(cur.cmd.length); return }
    const t = setTimeout(() => (done ? (setI(i + 1), setN(0)) : setN(n + 1)), done ? 2200 : 32)
    return () => clearTimeout(t)
  }, [n, i, done, cur])
  return (
    <div className="rounded-lg border border-brown/50 bg-ink/80 p-4 font-mono text-sm backdrop-blur">
      <p className="mb-2 text-xs text-muted">Illustrative example · policy: public reads only</p>
      <p><span className="text-amber">agent ›</span> {cur.cmd.slice(0, n)}<span className="caret">▍</span></p>
      <p className={`mt-1 min-h-6 transition-opacity duration-300 ${done ? 'opacity-100' : 'opacity-0'}`}>
        <span className={cur.ok ? 'text-amber' : 'text-danger'}>{cur.ok ? '✓ ALLOW' : '✕ DENY'}</span> <span className="text-muted">{cur.why}</span></p>
    </div>)
}

/** Result banner icon with a stroke-draw entrance. */
export function ResultSeal({ kind }: { kind: 'ok' | 'blocked' | 'partial' | 'warn' }) {
  const col = kind === 'ok' ? '#B99D73' : kind === 'warn' ? '#A39580' : '#D17A62'
  const icon = kind === 'ok' ? 'M20 33l8 8 16-17' : kind === 'blocked' ? 'M23 23l18 18M41 23 23 41' : 'M32 19v17M32 44v1'
  return <svg aria-hidden width="64" height="64" viewBox="0 0 64 64" fill="none" stroke={col} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="28" pathLength={100} className="draw" /><path d={icon} pathLength={100} className="draw" style={{ animationDelay: '.55s' }} /></svg>
}
