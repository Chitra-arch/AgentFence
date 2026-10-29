# AgentFence

Test simulated AI-agent tool actions against security policies (default deny, explicit deny beats allow,
action limits) with a persistent audit log and exportable run reports. Synthetic data only: it does not
protect real-world agents.

Palette: charcoal #090907, earth brown #6C5636, burnt amber #B99D73.

```
agentfence/
  backend/    FastAPI + SQLAlchemy + policy engine + pytest tests
  frontend/   React + TypeScript + Vite + Tailwind + TanStack Query
```

## Prerequisites
Python 3.11+, Node 20+ and npm. (PostgreSQL is optional; SQLite is the default.)

Live demo: https://agent-fence-nine.vercel.app

## 1. Start the backend (terminal 1)
macOS / Linux:
```
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Windows (PowerShell): `py -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt; copy .env.example .env`

Open `backend/.env` and set `JWT_SECRET` to a random 32+ character value
(generate one with `python -c "import secrets; print(secrets.token_hex(32))"`). The server refuses to start without it.
```
uvicorn app.main:app --reload --env-file .env
```
Check http://localhost:8000/health and the API docs at http://localhost:8000/docs.

## 2. Start the frontend (terminal 2)
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173, choose "Create an account", then use Scenarios -> Run scenario.
The Vite dev server proxies /api to the backend on port 8000, so no CORS setup is needed.

## 3. Try the main flow
1. Scenarios -> run "Public document access": one allowed action.
2. Run "Confidential document access": denied, with the reason shown and no content returned.
3. Run "Excessive tool actions": 3 allowed, 2 denied (limit exceeded).
4. Open a run, export JSON or CSV. Check Audit for filters and pagination. Edit a policy and rerun to see the version change.

## Tests
Backend: `cd backend && pytest -v` (9 policy-engine tests + 8 API tests).
Frontend type check and build: `cd frontend && npm run build`.

## PostgreSQL (optional)
Create a database, then set in backend/.env:
`DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/agentfence` and restart the backend.

## Security notes
Default deny; deny beats allow; missing or disabled policy fails closed; denied actions never reach the executor;
every route checks workspace ownership (other users' resources return 404); Argon2 password hashing; short-lived JWT held in memory only.

## Status
Done: policy engine, auth, REST API, audit log, reports, full frontend (dashboard, policies, scenarios, run detail, audit, settings).
UI: landing page, particle network, animated policy-gate illustration, typewriter demo, cursor glow, scroll reveals, sequenced page transitions, animated stats and decision bars, skeleton loaders, slide-in mobile drawer, toasts (all disabled under prefers-reduced-motion).
Not done / not verified: Alembic migrations (tables are created at startup), auth rate limiting, frontend Vitest tests,
Playwright end-to-end tests, deployment, audit date filter, React Hook Form/Zod/shadcn (plain controlled forms used instead).
The backend tests and the frontend build were written without network access and have not been run yet.

## 📸 Screenshots

### 1. Dashboard Overview
The main AgentFence dashboard provides an overview of the AI agent security monitoring environment.

![AgentFence Dashboard Overview](screenshots/01-dashboard-overview.png)

### 2. Dashboard Analytics
Visualize policy evaluation metrics and security activity through the dashboard analytics.

![AgentFence Dashboard Analytics](screenshots/02-dashboard-analytics.png)

### 3. Dashboard Activity
Review recent activity and monitor AI agent action events.

![AgentFence Dashboard Activity](screenshots/03-dashboard-activity.png)

### 4. Policy Management
Inspect and manage policies that determine whether AI agent actions are allowed or denied.

![AgentFence Policy Management](screenshots/04-policy-management.png)

### 5. Audit Logs
Review recorded action evaluations to support traceability and auditing.

![AgentFence Audit Logs](screenshots/05-audit-logs.png)
