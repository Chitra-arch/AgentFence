import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, FileDown, GitBranch, Lock, ScrollText, ShieldCheck, Workflow } from 'lucide-react'
import { useAuth } from './auth'
import { Aurora, FenceDiagram, Particles, Reveal, Terminal } from './fx'
import { btn, btnPrimary, card, glowMove, Logo } from './ui'

const features = [
  { icon: ShieldCheck, t: 'Default-deny policy engine', d: 'Explicit deny beats allow, anything unmatched is blocked, and a missing policy fails closed.' },
  { icon: Workflow, t: 'Deterministic scenarios', d: 'Replayable action sequences against synthetic resources. Same input, same verdict, every time.' },
  { icon: ScrollText, t: 'Persistent audit log', d: 'Every decision is stored with its reason, sequence number and the policy version that made it.' },
  { icon: GitBranch, t: 'Versioned policies', d: 'Each edit bumps the version, and every run records exactly which version it used.' },
  { icon: Lock, t: 'Workspace isolation', d: 'Per-user workspaces, checked on every request. Other workspaces are invisible by design.' },
  { icon: FileDown, t: 'Exportable reports', d: 'Download any run as JSON or CSV that matches the stored audit events exactly.' },
]
const steps = [['01', 'Write a policy', 'Pick tools and resource classes, choose allow or deny, set an action limit.'],
  ['02', 'Run a scenario', 'Execute a simulated agent sequence inside the sandbox and watch decisions land.'],
  ['03', 'Inspect and export', 'Open the run, read each reason, filter the audit log, export the report.']]

export default function Landing() {
  const { authed } = useAuth()
  if (authed) return <Navigate to="/dashboard" replace />
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 text-amber"><Logo size={24} /><span className="text-lg font-semibold">AgentFence</span></span>
        <nav className="flex items-center gap-3"><Link className={btn} to="/login">Sign in</Link><Link className={`${btnPrimary} hidden sm:inline-flex`} to="/login?mode=register">Get started</Link></nav>
      </header>

      <section className="relative">
        <Aurora /><div className="grid-bg pointer-events-none absolute inset-0" /><Particles density={85} />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
          <div className="stagger">
            <p className="inline-flex items-center gap-2 rounded-full border border-brown/60 bg-panel/70 px-3 py-1 text-xs text-amber"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />AI agent security testing · synthetic sandbox</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] sm:text-6xl">Put a <span className="shine">fence</span> around your AI agents.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Define policies, replay agent tool actions in a controlled sandbox, and see exactly what was allowed, what was blocked, and why. Every decision is audited.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={`${btnPrimary} px-5 py-2.5 text-base`} to="/login?mode=register">Create a free sandbox <ArrowRight size={16} aria-hidden /></Link>
              <Link className={`${btn} px-5 py-2.5 text-base`} to="/login">Sign in</Link></div>
          </div>
          <div className="float rounded-2xl border border-brown/50 bg-panel/60 p-4 shadow-[0_30px_80px_-30px_rgba(185,157,115,.35)] backdrop-blur"><FenceDiagram className="w-full" /></div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-5"><Reveal><Terminal /></Reveal></section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-24">
        <Reveal><h2 className="text-center text-3xl font-semibold">Security you can <span className="shine">verify</span>, not assume</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Small, auditable rules with predictable outcomes.</p></Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, t, d }, i) => <Reveal key={t} delay={i * 70}>
            <div onPointerMove={glowMove} className={`${card} glow lift h-full p-5`}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-brown/60 text-amber"><Icon size={18} aria-hidden /></div>
              <h3 className="font-medium">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></Reveal>)}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-24">
        <Reveal><h2 className="text-center text-3xl font-semibold">How it works</h2></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map(([n, t, d], i) => <Reveal key={n} delay={i * 120}><div className="border-l border-brown/60 pl-5">
            <p className="text-4xl font-semibold text-brown">{n}</p><h3 className="mt-2 font-medium">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></Reveal>)}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-brown/40 py-20 text-center">
        <Aurora /><Reveal className="relative z-10 px-5"><h2 className="text-3xl font-semibold">Ready to test your first policy?</h2>
          <Link className={`${btnPrimary} mt-6 px-6 py-3 text-base`} to="/login?mode=register">Create a free sandbox <ArrowRight size={16} aria-hidden /></Link>
          <p className="mx-auto mt-6 max-w-xl text-xs text-muted">AgentFence tests simulated tool actions on synthetic data. It does not protect real-world AI agents.</p></Reveal>
      </section>
    </div>)
}
