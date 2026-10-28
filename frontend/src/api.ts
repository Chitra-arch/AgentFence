export type Rule = { tool: string; resource_class: string; effect: 'allow' | 'deny' }
export type Workspace = { id: string; name: string }
export type Policy = { id: string; name: string; rules: Rule[]; max_actions: number | null; version: number; enabled: boolean; updated_at: string }
export type PolicyBody = { name: string; rules: Rule[]; max_actions: number | null }
export type Scenario = { id: string; name: string; description: string; action_count: number; latest_run_status: string | null; latest_run_id: string | null }
export type Run = { id: string; scenario_id: string; policy_version: number | null; status: string; allowed: number; denied: number; failed: number; started_at: string; finished_at: string | null }
export type Decision = 'ALLOW' | 'DENY' | 'FAILED'
export type AuditEvent = { id: string; run_id: string; sequence: number; action: string; resource: string; decision: Decision; reason: string; policy_version: number | null; created_at: string }
export type Page<T> = { total: number; limit: number; offset: number; items: T[] }

// The token lives in memory only (never localStorage): a refresh logs you out by design.
let token: string | null = null
export const setToken = (t: string | null) => { token = t }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const r = await fetch(path, { ...init, headers })
  if (!r.ok) {
    let msg = r.statusText
    try { const j = await r.json(); msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j) } catch { /* keep statusText */ }
    throw new ApiError(r.status, msg)
  }
  return r
}
async function json<T>(path: string, init?: RequestInit): Promise<T> { return (await raw(path, init)).json() as Promise<T> }
const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const api = {
  login: (email: string, password: string) => json<{ access_token: string }>('/api/v1/auth/login', send('POST', { email, password })),
  register: (email: string, password: string) => json<{ access_token: string }>('/api/v1/auth/register', send('POST', { email, password })),
  me: () => json<{ id: string; email: string }>('/api/v1/auth/me'),
  workspaces: () => json<Workspace[]>('/api/v1/workspaces'),
  policies: (w: string) => json<Policy[]>(`/api/v1/workspaces/${w}/policies`),
  createPolicy: (w: string, b: PolicyBody) => json<Policy>(`/api/v1/workspaces/${w}/policies`, send('POST', b)),
  updatePolicy: (id: string, b: PolicyBody) => json<Policy>(`/api/v1/policies/${id}`, send('PUT', b)),
  setStatus: (id: string, enabled: boolean) => json<Policy>(`/api/v1/policies/${id}/status`, send('PATCH', { enabled })),
  scenarios: (w: string) => json<Scenario[]>(`/api/v1/workspaces/${w}/scenarios`),
  runScenario: (id: string) => json<Run>(`/api/v1/scenarios/${id}/runs`, { method: 'POST' }),
  runs: (w: string) => json<Page<Run>>(`/api/v1/workspaces/${w}/runs`),
  run: (id: string) => json<Run>(`/api/v1/runs/${id}`),
  runEvents: (id: string) => json<AuditEvent[]>(`/api/v1/runs/${id}/events`),
  audit: (w: string, qs: string) => json<Page<AuditEvent>>(`/api/v1/workspaces/${w}/audit-events?${qs}`),
}

export async function download(runId: string, format: 'json' | 'csv') {
  const b = await (await raw(`/api/v1/runs/${runId}/report?format=${format}`)).blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b); a.download = `agentfence-run-${runId}.${format}`; a.click()
  URL.revokeObjectURL(a.href)
}
