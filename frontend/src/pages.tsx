import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Play, Plus, Trash2 } from 'lucide-react'
import { api, download, type Policy, type Rule } from './api'
import { useAuth, useWs } from './auth'
import { Aurora, FenceDiagram, Particles, ResultSeal } from './fx'
import { ActionBars, Donut, Kpi, NoData, Panel, StackedBars } from './charts'
import { Badge, btn, btnPrimary, card, Empty, ErrorBox, fmt, glowMove, input, Loading, Logo, Spinner, SplitBar, useToast } from './ui'

const TOOLS = ['read_document', 'query_sample_records', 'delete_record']
const CLASSES = ['public', 'internal', 'confidential']
const th = 'px-3 py-2 text-left font-medium text-muted'
const td = 'px-3 py-2 align-top'

export function AuthPage() {
  const { login } = useAuth(); const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>(new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const m = useMutation({
    mutationFn: () => (mode === 'login' ? api.login(email, pw) : api.register(email, pw)),
    onSuccess: (r) => { login(r.access_token); nav('/dashboard') },
  })
  const short = mode === 'register' && pw.length > 0 && pw.length < 10
  const submit = (e: FormEvent) => { e.preventDefault(); if (!short && !m.isPending) m.mutate() }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-brown/40 bg-panel/60 p-12 lg:flex">
        <Aurora /><Particles density={45} />
        <div className="relative z-10 flex items-center gap-2 text-amber"><Logo size={26} /><span className="text-lg font-semibold">AgentFence</span></div>
        <div className="stagger relative z-10 max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">Prove what your agents can, and cannot, do.</h2>
          <FenceDiagram className="w-full" />
          {[['Default deny', 'Every action is blocked unless a policy explicitly allows it.'],
            ['Deterministic decisions', 'Same policy, same action, same verdict, with the reason recorded.'],
            ['Audit everything', 'Persistent events and exportable run reports.']].map(([t, d]) =>
            <div key={t}><p className="font-medium text-amber">{t}</p><p className="text-sm text-muted">{d}</p></div>)}
        </div>
        <p className="relative z-10 text-xs text-muted">Simulated actions on synthetic data only.</p>
      </aside>
      <main className="page-enter flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 text-amber lg:hidden"><Logo /><span className="font-semibold">AgentFence</span></div>
          <h1 className="text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
          <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Sign in to your policies, runs and audit log.' : 'You get a private sandbox with three ready-made scenarios.'}</p>
          <form onSubmit={submit} className={`${card} mt-6 space-y-3 p-5`}>
            <label className="block text-sm">Email<input className={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm">Password<input className={input} type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            {short && <p className="text-xs text-danger">Use at least 10 characters.</p>}
            {m.error && <ErrorBox error={m.error} />}
            <button className={`${btnPrimary} w-full justify-center`} disabled={m.isPending}>{m.isPending && <Spinner />}{m.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
            <button type="button" className="text-xs text-amber underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); m.reset() }}>
              {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
          </form>
        </div>
      </main>
    </div>)
}

const RANGES = [7, 14, 30]
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
type SortKey = 'name' | 'runs' | 'denied' | 'rate'

export function Dashboard() {
  const { wsId } = useWs(); const enabled = !!wsId
  const [sp, setSp] = useSearchParams()
  const days = RANGES.includes(Number(sp.get('days'))) ? Number(sp.get('days')) : 14
  const [sort, setSort] = useState<SortKey>('runs')
  const runs = useQuery({ queryKey: ['runs', wsId], queryFn: () => api.runs(wsId!), enabled })
  const an = useQuery({ queryKey: ['analytics', wsId, days], queryFn: () => api.analytics(wsId!, days), enabled })
  const scenarios = useQuery({ queryKey: ['scenarios', wsId], queryFn: () => api.scenarios(wsId!), enabled })
  if (runs.isLoading) return <Loading />
  if (runs.error) return <ErrorBox error={runs.error} retry={() => runs.refetch()} />
  if (!runs.data || runs.data.total === 0)
    return <Empty title="No runs yet" action={<Link className={btnPrimary} to="/scenarios"><Play size={14} />Run your first scenario</Link>}>
      Nothing has been executed in this workspace. Run a seeded scenario to see allow/deny decisions and analytics appear here.</Empty>
  const names = new Map((scenarios.data ?? []).map((s) => [s.id, s.name]))
  const a = an.data
  const total = a ? a.allowed + a.denied + a.failed : 0
  const rate = (r: { allowed: number; denied: number; failed: number }) => r.denied / Math.max(1, r.allowed + r.denied + r.failed)
  const byScenario = a ? [...a.by_scenario].sort((x, y) => sort === 'name' ? x.name.localeCompare(y.name) : sort === 'runs' ? y.runs - x.runs : sort === 'denied' ? y.denied - x.denied : rate(y) - rate(x)) : []
  const sortBtn = (k: SortKey, label: string) => <button className="hover:text-amber" onClick={() => setSort(k)}>{label}{sort === k ? (k === 'name' ? ' ↑' : ' ↓') : ''}</button>
  const maxReason = Math.max(1, ...(a?.top_reasons.map((r) => r.count) ?? [1]))
  return (
    <div className="stagger space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Time range" className="inline-flex overflow-hidden rounded-md border border-brown">
          {RANGES.map((n) => <button key={n} aria-pressed={days === n} onClick={() => setSp({ days: String(n) })}
            className={`px-3 py-1.5 text-sm transition-colors ${days === n ? 'bg-amber text-ink' : 'hover:bg-brown/20'}`}>{n} days</button>)}</div>
        <Link className={btnPrimary} to="/scenarios"><Play size={14} />Run a scenario</Link></div>

      {an.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
        : an.error ? <ErrorBox error={an.error} retry={() => an.refetch()} /> : a && <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Runs executed" value={a.runs} hint={`last ${days} days`} /><Kpi label="Actions allowed" value={a.allowed} />
          <Kpi label="Actions blocked" value={a.denied} /><Kpi label="Block rate" value={total ? Math.round((a.denied / total) * 100) : 0} suffix="%" hint="denied ÷ all actions" /></div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Decisions over time" hint={`last ${days} days`} className="lg:col-span-2">{total ? <StackedBars data={a.daily} /> : <NoData days={days} />}</Panel>
          <Panel title="Decision mix">{total ? <Donut allowed={a.allowed} denied={a.denied} failed={a.failed} /> : <NoData days={days} />}</Panel></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Actions by tool">{a.by_action.length ? <ActionBars rows={a.by_action} /> : <NoData days={days} />}</Panel>
          <Panel title="Top block reasons" hint="denied + failed">{a.top_reasons.length ?
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>Reason</th><th className={th}>Count</th></tr></thead>
              <tbody className="stagger-rows">{a.top_reasons.map((r) => <tr key={r.reason} className="border-t border-brown/30"><td className={td}>{r.reason}
                <div className="mt-1 h-1 rounded bg-ink"><div className="h-1 rounded bg-danger" style={{ width: `${(r.count / maxReason) * 100}%` }} /></div></td>
                <td className={`${td} tabular-nums`}>{r.count}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-sm text-muted">Nothing was blocked in this period.</p>}</Panel></div>
        <Panel title="Scenario performance" hint="click a header to sort">{byScenario.length ?
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>
            <th className={th}>{sortBtn('name', 'Scenario')}</th><th className={th}>{sortBtn('runs', 'Runs')}</th><th className={th}>Allowed</th>
            <th className={th}>{sortBtn('denied', 'Blocked')}</th><th className={th}>{sortBtn('rate', 'Block rate')}</th><th className={th}>Last run</th></tr></thead>
            <tbody className="stagger-rows">{byScenario.map((r) => <tr key={r.scenario_id} className="border-t border-brown/30">
              <td className={td}>{r.name}</td><td className={`${td} tabular-nums`}>{r.runs}</td><td className={`${td} tabular-nums`}>{r.allowed}</td><td className={`${td} tabular-nums`}>{r.denied}</td>
              <td className={td}><span className="tabular-nums">{pct(r.denied, r.allowed + r.denied + r.failed)}</span></td><td className={td}>{fmt(r.last_run_at)}</td></tr>)}</tbody></table></div> : <NoData days={days} />}</Panel>
        <Panel title="Policy versions in use" hint="which version made the decisions">{a.by_policy_version.length ?
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>Version</th><th className={th}>Allowed</th><th className={th}>Denied</th><th className={th}>Failed</th><th className={th}>Block rate</th></tr></thead>
            <tbody className="stagger-rows">{a.by_policy_version.map((r) => <tr key={String(r.version)} className="border-t border-brown/30">
              <td className={td}>{r.version == null ? 'none (fail closed)' : `v${r.version}`}</td><td className={`${td} tabular-nums`}>{r.allowed}</td><td className={`${td} tabular-nums`}>{r.denied}</td>
              <td className={`${td} tabular-nums`}>{r.failed}</td><td className={`${td} tabular-nums`}>{pct(r.denied, r.allowed + r.denied + r.failed)}</td></tr>)}</tbody></table></div> : <NoData days={days} />}</Panel>
      </>}

      <section><h2 className="mb-2 font-medium">Recent activity</h2>
        <div className={`${card} overflow-x-auto`}><table className="w-full text-sm"><thead><tr><th className={th}>Scenario</th><th className={th}>Status</th><th className={th}>Allowed</th><th className={th}>Denied</th><th className={th}>Started</th></tr></thead>
          <tbody className="stagger-rows">{runs.data.items.map((r) => <tr key={r.id} className="border-t border-brown/30">
            <td className={td}><Link className="text-amber underline" to={`/runs/${r.id}`}>{names.get(r.scenario_id) ?? 'Scenario'}</Link></td>
            <td className={td}>{r.status}</td><td className={td}>{r.allowed}</td><td className={td}>{r.denied}</td><td className={td}>{fmt(r.started_at)}</td></tr>)}</tbody></table></div></section>
    </div>)
}

type Draft = { name: string; max: string; rules: Rule[] }
const blank: Draft = { name: '', max: '', rules: [{ tool: 'read_document', resource_class: 'public', effect: 'allow' }] }

export function Policies() {
  const { wsId } = useWs(); const qc = useQueryClient(); const toast = useToast()
  const q = useQuery({ queryKey: ['policies', wsId], queryFn: () => api.policies(wsId!), enabled: !!wsId })
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blank); const [dirty, setDirty] = useState(false)
  const policies = q.data ?? []
  const current: Policy | undefined = policies.find((p) => p.id === sel)
  const load = (p?: Policy) => { setDraft(p ? { name: p.name, max: p.max_actions == null ? '' : String(p.max_actions), rules: p.rules } : blank); setDirty(false) }
  useEffect(() => { if (sel === null && policies.length) { setSel(policies[0].id); load(policies[0]) } }, [policies, sel])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  const choose = (id: string) => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setSel(id); load(policies.find((p) => p.id === id))
  }
  const edit = (d: Partial<Draft>) => { setDraft((x) => ({ ...x, ...d })); setDirty(true) }
  const setRule = (i: number, r: Partial<Rule>) => edit({ rules: draft.rules.map((x, j) => (j === i ? { ...x, ...r } : x)) })
  const errs: string[] = []
  if (!draft.name.trim()) errs.push('Name is required.')
  if (draft.max !== '' && !(Number.isInteger(+draft.max) && +draft.max >= 0)) errs.push('Action limit must be a whole number ≥ 0 (or empty).')
  const save = useMutation({
    mutationFn: () => {
      const body = { name: draft.name.trim(), rules: draft.rules, max_actions: draft.max === '' ? null : +draft.max }
      return sel && sel !== 'new' ? api.updatePolicy(sel, body) : api.createPolicy(wsId!, body)
    },
    onSuccess: (p) => { setSel(p.id); setDirty(false); toast(`Saved “${p.name}” (v${p.version})`); qc.invalidateQueries({ queryKey: ['policies'] }) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Save failed', true),
  })
  const toggle = useMutation({
    mutationFn: (p: Policy) => api.setStatus(p.id, !p.enabled),
    onSuccess: (p) => { toast(p.enabled ? 'Policy enabled' : 'Policy disabled'); qc.invalidateQueries({ queryKey: ['policies'] }) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Update failed', true),
  })
  if (q.isLoading) return <Loading />
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-2">
        {policies.map((p) => <button key={p.id} onClick={() => choose(p.id)} className={`${card} lift w-full p-3 text-left hover:border-amber ${sel === p.id ? 'border-amber' : ''}`}>
          <span className="block text-sm font-medium">{p.name}</span><span className="text-xs text-muted">v{p.version} · {p.enabled ? 'Enabled' : 'Disabled'}</span></button>)}
        <button className={`${btn} w-full justify-center`} onClick={() => { if (dirty && !confirm('Discard unsaved changes?')) return; setSel('new'); load() }}><Plus size={14} />New policy</button>
      </div>
      <form className={`${card} space-y-4 p-5`} onSubmit={(e) => { e.preventDefault(); if (!errs.length && !save.isPending) save.mutate() }}>
        <p className="rounded-md border border-brown/50 p-3 text-sm text-muted"><strong className="text-fg">Default deny.</strong> Any action matching no rule is denied. If a deny and an allow rule both match, deny wins. <code>delete_record</code> is always denied in v1.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-48 flex-1 text-sm">Name<input className={input} value={draft.name} onChange={(e) => edit({ name: e.target.value })} /></label>
          <label className="w-40 text-sm">Max actions / run<input className={input} inputMode="numeric" placeholder="unlimited" value={draft.max} onChange={(e) => edit({ max: e.target.value })} /></label>
        </div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Rules</legend>
          {draft.rules.map((r, i) => <div key={i} className="page-enter flex flex-wrap items-center gap-2">
            <select aria-label="Tool" className={`${input} w-auto`} value={r.tool} onChange={(e) => setRule(i, { tool: e.target.value })}>{TOOLS.map((t) => <option key={t}>{t}</option>)}</select>
            <select aria-label="Resource class" className={`${input} w-auto`} value={r.resource_class} onChange={(e) => setRule(i, { resource_class: e.target.value })}>{CLASSES.map((t) => <option key={t}>{t}</option>)}</select>
            <select aria-label="Effect" className={`${input} w-auto`} value={r.effect} onChange={(e) => setRule(i, { effect: e.target.value as Rule['effect'] })}><option>allow</option><option>deny</option></select>
            <button type="button" className={btn} aria-label="Remove rule" onClick={() => edit({ rules: draft.rules.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></div>)}
          <button type="button" className={btn} onClick={() => edit({ rules: [...draft.rules, { tool: 'read_document', resource_class: 'public', effect: 'allow' }] })}><Plus size={14} />Add rule</button>
          {draft.rules.length === 0 && <p className="text-xs text-muted">No rules: everything is denied.</p>}
        </fieldset>
        {errs.map((e) => <p key={e} role="alert" className="text-sm text-danger">{e}</p>)}
        {save.error && <ErrorBox error={save.error} />}
        <div className="flex flex-wrap items-center gap-3">
          <button className={btnPrimary} disabled={save.isPending || errs.length > 0}>{save.isPending && <Spinner />}{save.isPending ? 'Saving…' : sel === 'new' || !sel ? 'Create policy' : 'Save new version'}</button>
          {dirty && <span className="text-xs text-amber">Unsaved changes</span>}
          {current && <button type="button" className={btn} disabled={toggle.isPending} onClick={() => toggle.mutate(current)}>{current.enabled ? 'Disable' : 'Enable'}</button>}
          {current && <span className="text-xs text-muted">Version {current.version} · updated {fmt(current.updated_at)}. Each save increments the version; runs record the version they used.</span>}
        </div>
      </form>
    </div>)
}

export function Scenarios() {
  const { wsId } = useWs(); const qc = useQueryClient(); const nav = useNavigate(); const toast = useToast()
  const q = useQuery({ queryKey: ['scenarios', wsId], queryFn: () => api.scenarios(wsId!), enabled: !!wsId })
  const run = useMutation({
    mutationFn: (id: string) => api.runScenario(id),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['runs'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); qc.invalidateQueries({ queryKey: ['audit'] }); qc.invalidateQueries({ queryKey: ['scenarios'] }); nav(`/runs/${r.id}`) },
    onError: (e) => toast(e instanceof Error ? e.message : 'Run failed', true),
  })
  if (q.isLoading) return <Loading />
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  if (!q.data?.length) return <Empty title="No scenarios">This workspace has no scenarios.</Empty>
  return (
    <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {q.data.map((s) => { const busy = run.isPending && run.variables === s.id
        return <article key={s.id} onPointerMove={glowMove} className={`${card} glow lift flex flex-col p-4`}>
          <h2 className="font-medium">{s.name}</h2><p className="mt-1 flex-1 text-sm text-muted">{s.description}</p>
          <p className="mt-3 text-xs text-muted">{s.action_count} action{s.action_count === 1 ? '' : 's'} · latest run: {s.latest_run_id ? <Link className="text-amber underline" to={`/runs/${s.latest_run_id}`}>{s.latest_run_status}</Link> : 'never'}</p>
          <div className="mt-3 flex items-center gap-2">
            <button className={btnPrimary} disabled={run.isPending} onClick={() => run.mutate(s.id)}>{busy ? <Spinner /> : <Play size={14} />}{busy ? 'Running…' : 'Run scenario'}</button>
            {run.isError && run.variables === s.id && <button className={btn} onClick={() => run.mutate(s.id)}>Retry</button>}</div>
        </article> })}
    </div>)
}

export function RunDetail() {
  const { runId = '' } = useParams(); const [sp, setSp] = useSearchParams(); const toast = useToast()
  const filter = sp.get('decision') ?? ''
  const run = useQuery({ queryKey: ['run', runId], queryFn: () => api.run(runId) })
  const ev = useQuery({ queryKey: ['run-events', runId], queryFn: () => api.runEvents(runId) })
  if (run.isLoading || ev.isLoading) return <Loading />
  if (run.error || ev.error) return <ErrorBox error={run.error ?? ev.error} retry={() => { run.refetch(); ev.refetch() }} />
  const r = run.data!; const rows = (ev.data ?? []).filter((e) => !filter || e.decision === filter)
  const verdict = (r.failed ? ['warn', 'Run finished with failures', 'An action failed during execution.'] : r.denied === 0 ? ['ok', 'All actions allowed', 'Every action matched an allow rule.'] : r.allowed === 0 ? ['blocked', 'All actions blocked', 'The policy permitted none of these actions.'] : ['partial', 'Partially blocked', 'Some actions were allowed and the rest were denied.']) as ['ok' | 'blocked' | 'partial' | 'warn', string, string]
  const exp = (f: 'json' | 'csv') => download(runId, f).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Export failed', true))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Status: <strong>{r.status}</strong></span>
        <span className="text-sm text-muted">{r.allowed} allowed · {r.denied} denied · {r.failed} failed · policy {r.policy_version == null ? 'none (fail closed)' : `v${r.policy_version}`} · {fmt(r.started_at)}</span>
        <span className="flex-1" />
        <label className="sr-only" htmlFor="f">Filter</label>
        <select id="f" className={`${input} w-auto`} value={filter} onChange={(e) => setSp(e.target.value ? { decision: e.target.value } : {})}><option value="">All decisions</option><option value="ALLOW">Allowed</option><option value="DENY">Denied</option><option value="FAILED">Failed</option></select>
        <button className={btn} onClick={() => exp('json')}><Download size={14} />JSON</button><button className={btn} onClick={() => exp('csv')}><Download size={14} />CSV</button>
      </div>
      <div className={`${card} flex items-center gap-4 p-4`}><ResultSeal kind={verdict[0]} /><div><p className="text-lg font-medium">{verdict[1]}</p><p className="text-sm text-muted">{verdict[2]}</p></div></div>
      <SplitBar a={r.allowed} d={r.denied} f={r.failed} />
      {rows.length === 0 ? <Empty title="No matching actions" /> :
        <div className={`${card} overflow-x-auto`}><table className="w-full text-sm"><thead><tr>{['#', 'Decision', 'Action', 'Resource', 'Reason', 'Policy', 'Time'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody className="stagger-rows">{rows.map((e) => <tr key={e.id} className="border-t border-brown/30"><td className={td}>{e.sequence}</td><td className={td}><Badge d={e.decision} /></td><td className={`${td} font-mono`}>{e.action}</td><td className={`${td} font-mono`}>{e.resource}</td><td className={td}>{e.reason}</td><td className={td}>v{e.policy_version ?? '—'}</td><td className={td}>{fmt(e.created_at)}</td></tr>)}</tbody></table></div>}
    </div>)
}

export function Audit() {
  const { wsId } = useWs(); const [sp, setSp] = useSearchParams(); const [open, setOpen] = useState<string | null>(null)
  const decision = sp.get('decision') ?? ''; const action = sp.get('action') ?? ''; const runId = sp.get('run') ?? ''
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const qs = new URLSearchParams({ limit: '25', offset: String(offset) })
  if (decision) qs.set('decision', decision); if (action) qs.set('action', action); if (runId) qs.set('run_id', runId)
  const q = useQuery({ queryKey: ['audit', wsId, 'list', qs.toString()], queryFn: () => api.audit(wsId!, qs.toString()), enabled: !!wsId })
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'offset') n.delete('offset'); setSp(n) }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select aria-label="Decision" className={`${input} w-auto`} value={decision} onChange={(e) => set('decision', e.target.value)}><option value="">All decisions</option><option value="ALLOW">Allowed</option><option value="DENY">Denied</option><option value="FAILED">Failed</option></select>
        <select aria-label="Action" className={`${input} w-auto`} value={action} onChange={(e) => set('action', e.target.value)}><option value="">All actions</option>{TOOLS.map((t) => <option key={t}>{t}</option>)}</select>
        {runId && <button className={btn} onClick={() => set('run', '')}>Run filter ✕</button>}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : !q.data?.items.length ? <Empty title="No audit events">Nothing matches these filters yet. Execute a scenario to generate events.</Empty> :
        <><div className={`${card} overflow-x-auto`}><table className="w-full text-sm"><thead><tr>{['', 'Decision', 'Action', 'Resource', 'Time', 'Run'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody className="stagger-rows">{q.data.items.map((e) => [
            <tr key={e.id} className="border-t border-brown/30"><td className={td}><button className="text-amber" aria-expanded={open === e.id} aria-label="Toggle details" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? '▾' : '▸'}</button></td>
              <td className={td}><Badge d={e.decision} /></td><td className={`${td} font-mono`}>{e.action}</td><td className={`${td} font-mono`}>{e.resource}</td><td className={td}>{fmt(e.created_at)}</td>
              <td className={td}><Link className="text-amber underline" to={`/runs/${e.run_id}`}>Open</Link> · <button className="text-amber underline" onClick={() => set('run', e.run_id)}>Filter</button></td></tr>,
            open === e.id && <tr key={e.id + 'd'} className="bg-ink"><td /><td colSpan={5} className="px-3 py-2 text-xs text-muted">Reason: {e.reason} · sequence {e.sequence} · policy v{e.policy_version ?? '—'} · event {e.id}</td></tr>])}</tbody></table></div>
          <div className="flex items-center gap-3 text-sm"><button className={btn} disabled={offset === 0} onClick={() => set('offset', String(Math.max(0, offset - 25)))}>Previous</button>
            <span className="text-muted">{offset + 1}–{Math.min(offset + 25, q.data.total)} of {q.data.total}</span>
            <button className={btn} disabled={offset + 25 >= q.data.total} onClick={() => set('offset', String(offset + 25))}>Next</button></div></>}
    </div>)
}

export function SettingsPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me }); const { current } = useWs()
  return (
    <div className="max-w-2xl space-y-4">
      <section className={`${card} p-4 text-sm`}><h2 className="mb-2 font-medium">Account</h2>
        {me.isLoading ? <Loading /> : me.error ? <ErrorBox error={me.error} retry={() => me.refetch()} /> : <p>Signed in as {me.data?.email}</p>}
        <p className="mt-1 text-muted">Workspace: {current?.name} <span className="font-mono text-xs">({current?.id})</span></p></section>
      <section className={`${card} p-4 text-sm text-muted`}><h2 className="mb-2 font-medium text-fg">Demo limitations</h2>
        <ul className="list-disc space-y-1 pl-5"><li>AgentFence does not protect arbitrary real-world AI agents. It tests simulated tool actions against your policies.</li>
          <li>Only synthetic resources and three allowlisted operations exist; <code>delete_record</code> is always denied.</li>
          <li>Audit events are append-only through the app but are not cryptographically tamper-proof.</li>
          <li>Your session token is kept in memory, so refreshing the page signs you out.</li></ul></section>
    </div>)
}
