import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Activity, FileText, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings as Cog, Shield, X } from 'lucide-react'
import { useAuth, useWs } from './auth'
import Landing from './landing'
import { Particles } from './fx'
import { AuthPage, Audit, Dashboard, Policies, RunDetail, Scenarios, SettingsPage } from './pages'
import { btn, ErrorBox, Loading, Logo } from './ui'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Live summary of runs and decisions in this workspace.' },
  { to: '/policies', label: 'Policies', icon: Shield, desc: 'Rules that decide which tool actions are allowed. Everything else is denied.' },
  { to: '/scenarios', label: 'Scenarios', icon: Activity, desc: 'Deterministic simulated agent action sequences you can execute.' },
  { to: '/audit', label: 'Audit', icon: FileText, desc: 'Persistent record of every decision in this workspace.' },
  { to: '/settings', label: 'Settings', icon: Cog, desc: 'Account, workspace and demo limitations.' },
]

function Shell() {
  const { authed, logout, setWsId } = useAuth()
  const { workspaces, current, query } = useWs()
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  if (!authed) return <Navigate to="/login" replace />
  const page = nav.find((n) => loc.pathname.startsWith(n.to)) ?? { label: 'Run details', desc: 'Persisted results for one scenario run.' }
  const links = (c: boolean) => (
    <nav aria-label="Main" className="flex flex-col gap-1 p-2">
      {nav.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} title={label}
          className={({ isActive }) => `relative flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-brown/20 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded before:bg-amber before:transition-opacity ${isActive ? 'bg-brown/30 text-amber before:opacity-100' : 'text-fg before:opacity-0'}`}>
          <Icon size={16} aria-hidden className="shrink-0" />{!c && label}
        </NavLink>))}
    </nav>)
  return (
    <div className="flex min-h-screen">
      <div aria-hidden className="fixed inset-0 -z-10 opacity-60"><Particles density={40} /></div>
      <aside className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-brown/50 bg-panel transition-[width] duration-300 ease-out md:block ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center justify-between p-3 text-amber">
          <span className="flex items-center gap-2 whitespace-nowrap font-semibold"><Logo />{!collapsed && 'AgentFence'}</span>
          {!collapsed && <button className="text-muted hover:text-amber" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><PanelLeftClose size={16} /></button>}
        </div>
        {collapsed && <button className="mx-auto mb-1 block text-muted hover:text-amber" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><PanelLeftOpen size={16} /></button>}
        {links(collapsed)}
      </aside>

      <div aria-hidden onClick={() => setOpen(false)} className={`fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside aria-label="Navigation drawer" className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-brown/50 bg-panel transition-[transform,visibility] duration-300 ease-out md:hidden ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}>
        <div className="flex items-center justify-between p-3 text-amber"><span className="flex items-center gap-2 font-semibold"><Logo />AgentFence</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        {links(false)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-brown/50 bg-ink/80 px-4 py-3 backdrop-blur">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <div className="min-w-0 flex-1"><h1 className="text-lg font-semibold">{page.label}</h1><p className="text-sm text-muted">{page.desc}</p></div>
          <label className="sr-only" htmlFor="ws">Workspace</label>
          <select id="ws" className="rounded-md border border-brown bg-ink px-2 py-1.5 text-sm transition-colors hover:border-amber" value={current?.id ?? ''} onChange={(e) => setWsId(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          <button className={btn} onClick={logout}><LogOut size={14} aria-hidden />Sign out</button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {query.isLoading ? <Loading /> : query.error ? <ErrorBox error={query.error} retry={() => query.refetch()} /> :
            <div key={loc.pathname} className="page-enter"><Outlet /></div>}
        </main>
      </div>
    </div>)
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Shell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/scenarios" element={<Scenarios />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>)
}
