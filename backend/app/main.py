import csv, io, os, uuid
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from .db import Base, engine, get_db
from .models import AuditEvent, Policy, Run, Scenario, User, Workspace
from .security import hash_password, make_token, read_token, verify_password
from .seed import seed_workspace
from .services import policy_engine as pe

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)  # TODO: replace with Alembic migrations
    yield

app = FastAPI(title="AgentFence", version="0.3.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])

class RuleIn(BaseModel):
    tool: str
    resource_class: str
    effect: Literal["allow", "deny"]

class PolicyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rules: list[RuleIn]
    max_actions: int | None = Field(default=None, ge=0)

class StatusIn(BaseModel):
    enabled: bool

def validate(p: PolicyIn) -> None:
    try:  # reuse the engine's validation so API and engine can never disagree
        pe.Policy(1, tuple(pe.Rule(**r.model_dump()) for r in p.rules), True, p.max_actions)
    except pe.InvalidPolicy as e:
        raise HTTPException(422, str(e))

bearer = HTTPBearer(auto_error=False)

def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    uid = read_token(cred.credentials) if cred else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "invalid or missing token", headers={"WWW-Authenticate": "Bearer"})
    return user

def authorize_ws(db: Session, user: User, wid: uuid.UUID) -> Workspace:
    # SECURITY: every route funnels through here. Foreign workspaces return 404, not 403,
    # so ids of other users' resources cannot be probed.
    ws = db.get(Workspace, wid)
    if not ws or ws.owner_id != user.id: raise HTTPException(404, "not found")
    return ws

def owned(db: Session, user: User, model, id_: uuid.UUID):
    obj = db.get(model, id_)
    if not obj: raise HTTPException(404, "not found")
    authorize_ws(db, user, obj.workspace_id)
    return obj

class Cred(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=10, max_length=128)

@app.post("/api/v1/auth/register", status_code=201)
def register(body: Cred, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, "email already registered")
    user = User(email=email, password_hash=hash_password(body.password)); db.add(user); db.flush()
    ws = Workspace(name="My workspace", owner_id=user.id); db.add(ws); db.flush()
    seed_workspace(db, ws)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(409, "email already registered")
    return {"access_token": make_token(user.id), "token_type": "bearer"}

@app.post("/api/v1/auth/login")
def login(body: Cred, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(user.password_hash, body.password):
        raise HTTPException(401, "invalid email or password")  # same message for both cases
    return {"access_token": make_token(user.id), "token_type": "bearer"}

@app.get("/api/v1/auth/me")
def me(user: User = Depends(current_user)): return {"id": user.id, "email": user.email}

def dump(o) -> dict:
    return {c.name: getattr(o, c.name) for c in o.__table__.columns}

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/api/v1/workspaces")
def workspaces(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [dump(w) for w in db.scalars(select(Workspace).where(Workspace.owner_id == user.id))]

class WsIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)

@app.post("/api/v1/workspaces", status_code=201)
def create_workspace(body: WsIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ws = Workspace(name=body.name, owner_id=user.id); db.add(ws); db.flush()
    seed_workspace(db, ws); db.commit(); return dump(ws)

@app.get("/api/v1/workspaces/{wid}/policies")
def list_policies(wid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    authorize_ws(db, user, wid)
    return [dump(p) for p in db.scalars(select(Policy).where(Policy.workspace_id == wid))]

@app.post("/api/v1/workspaces/{wid}/policies", status_code=201)
def create_policy(wid: uuid.UUID, body: PolicyIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    authorize_ws(db, user, wid); validate(body)
    p = Policy(workspace_id=wid, name=body.name, max_actions=body.max_actions,
               rules=[r.model_dump() for r in body.rules])
    db.add(p); db.commit(); return dump(p)

@app.get("/api/v1/policies/{pid}")
def get_policy(pid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)): return dump(owned(db, user, Policy, pid))

@app.put("/api/v1/policies/{pid}")
def update_policy(pid: uuid.UUID, body: PolicyIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = owned(db, user, Policy, pid); validate(body)
    p.name, p.max_actions, p.rules = body.name, body.max_actions, [r.model_dump() for r in body.rules]
    p.version += 1  # every edit is a new version; runs record the version they used
    db.commit(); return dump(p)

@app.patch("/api/v1/policies/{pid}/status")
def set_status(pid: uuid.UUID, body: StatusIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    p = owned(db, user, Policy, pid); p.enabled = body.enabled; db.commit(); return dump(p)

@app.get("/api/v1/workspaces/{wid}/scenarios")
def list_scenarios(wid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    authorize_ws(db, user, wid)
    out = []
    for s in db.scalars(select(Scenario).where(Scenario.workspace_id == wid)):
        last = db.scalar(select(Run).where(Run.scenario_id == s.id).order_by(Run.started_at.desc()).limit(1))
        out.append({**dump(s), "action_count": len(s.actions), "latest_run_status": last.status if last else None,
                    "latest_run_id": last.id if last else None})
    return out

@app.get("/api/v1/scenarios/{sid}")
def get_scenario(sid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)): return dump(owned(db, user, Scenario, sid))

@app.post("/api/v1/scenarios/{sid}/runs", status_code=201)
def run_scenario(sid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)):
    sc = owned(db, user, Scenario, sid)
    # One snapshot: read the active policy once, evaluate every action against it.
    row = db.scalar(select(Policy).where(Policy.workspace_id == sc.workspace_id, Policy.enabled.is_(True))
                    .order_by(Policy.updated_at.desc()).limit(1))
    policy = pe.Policy(row.version, tuple(pe.Rule(**r) for r in row.rules), True, row.max_actions) if row else None
    events = pe.run_actions(policy, [pe.Action(a["tool"], a["resource_id"]) for a in sc.actions])
    count = lambda d: sum(e.decision == d for e in events)
    run = Run(scenario_id=sc.id, workspace_id=sc.workspace_id, policy_id=row.id if row else None,
              policy_version=row.version if row else None, allowed=count("ALLOW"), denied=count("DENY"),
              failed=count("FAILED"), status="failed" if count("FAILED") else "completed",
              finished_at=datetime.now(timezone.utc))
    db.add(run); db.flush()
    db.add_all(AuditEvent(run_id=run.id, workspace_id=sc.workspace_id, sequence=e.sequence, action=e.tool,
                          resource=e.resource_id, decision=e.decision, reason=e.reason,
                          policy_version=e.policy_version) for e in events)
    db.commit()  # run + events persist atomically
    return dump(run)

@app.get("/api/v1/runs/{rid}")
def get_run(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)): return dump(owned(db, user, Run, rid))

def run_events(db: Session, user: User, rid: uuid.UUID):
    owned(db, user, Run, rid)
    return list(db.scalars(select(AuditEvent).where(AuditEvent.run_id == rid).order_by(AuditEvent.sequence)))

@app.get("/api/v1/runs/{rid}/events")
def events(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(current_user)): return [dump(e) for e in run_events(db, user, rid)]

@app.get("/api/v1/runs/{rid}/report")
def report(rid: uuid.UUID, format: Literal["json", "csv"] = "json", db: Session = Depends(get_db), user: User = Depends(current_user)):
    run, evs = owned(db, user, Run, rid), run_events(db, user, rid)
    if format == "json":
        return {"run": dump(run), "events": [dump(e) for e in evs]}
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["sequence", "action", "resource", "decision", "reason", "policy_version", "created_at"])
    for e in evs: w.writerow([e.sequence, e.action, e.resource, e.decision, e.reason, e.policy_version, e.created_at])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="run-{rid}.csv"'})

@app.get("/api/v1/workspaces/{wid}/audit-events")
def audit(wid: uuid.UUID, decision: Literal["ALLOW", "DENY", "FAILED"] | None = None, action: str | None = None,
          run_id: uuid.UUID | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
          db: Session = Depends(get_db), user: User = Depends(current_user)):
    authorize_ws(db, user, wid)
    q = select(AuditEvent).where(AuditEvent.workspace_id == wid)  # workspace scope is always applied
    if decision: q = q.where(AuditEvent.decision == decision)
    if action: q = q.where(AuditEvent.action == action)
    if run_id: q = q.where(AuditEvent.run_id == run_id)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(AuditEvent.created_at.desc(), AuditEvent.sequence).limit(limit).offset(offset))
    return {"total": total, "limit": limit, "offset": offset, "items": [dump(e) for e in rows]}

@app.get("/api/v1/workspaces/{wid}/runs")
def list_runs(wid: uuid.UUID, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
              db: Session = Depends(get_db), user: User = Depends(current_user)):
    authorize_ws(db, user, wid)
    q = select(Run).where(Run.workspace_id == wid)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Run.started_at.desc()).limit(limit).offset(offset))
    return {"total": total, "limit": limit, "offset": offset, "items": [dump(r) for r in rows]}

@app.get("/api/v1/workspaces/{wid}/analytics")
def analytics(wid: uuid.UUID, days: int = Query(14, ge=1, le=90),
              db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Aggregates over the last `days` UTC days (today included), computed from persisted audit events only."""
    authorize_ws(db, user, wid)
    since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    where = (AuditEvent.workspace_id == wid, AuditEvent.created_at >= since)
    cnt = lambda d: func.coalesce(func.sum(case((AuditEvent.decision == d, 1), else_=0)), 0)
    iso = lambda v: v.isoformat() if hasattr(v, "isoformat") else v
    trio = lambda r: {"allowed": int(r[-3]), "denied": int(r[-2]), "failed": int(r[-1])}

    day = func.date(AuditEvent.created_at)
    by_day = {str(r[0]): r for r in db.execute(select(day, cnt("ALLOW"), cnt("DENY"), cnt("FAILED")).where(*where).group_by(day))}
    daily = []
    for i in range(days):
        d = (since + timedelta(days=i)).date().isoformat()
        daily.append({"date": d, **(trio(by_day[d]) if d in by_day else {"allowed": 0, "denied": 0, "failed": 0})})

    by_action = [{"action": r[0], **trio(r)} for r in db.execute(
        select(AuditEvent.action, cnt("ALLOW"), cnt("DENY"), cnt("FAILED")).where(*where).group_by(AuditEvent.action))]
    by_scenario = [{"scenario_id": r[0], "name": r[1], "runs": int(r[2]), "last_run_at": iso(r[3]), **trio(r[4:])} for r in db.execute(
        select(Scenario.id, Scenario.name, func.count(func.distinct(Run.id)), func.max(Run.started_at), cnt("ALLOW"), cnt("DENY"), cnt("FAILED"))
        .select_from(AuditEvent).join(Run, Run.id == AuditEvent.run_id).join(Scenario, Scenario.id == Run.scenario_id)
        .where(*where).group_by(Scenario.id, Scenario.name))]
    top_reasons = [{"reason": r[0], "count": int(r[1])} for r in db.execute(
        select(AuditEvent.reason, func.count()).where(*where, AuditEvent.decision != "ALLOW")
        .group_by(AuditEvent.reason).order_by(func.count().desc()).limit(5))]
    by_version = [{"version": r[0], **trio(r)} for r in db.execute(
        select(AuditEvent.policy_version, cnt("ALLOW"), cnt("DENY"), cnt("FAILED")).where(*where)
        .group_by(AuditEvent.policy_version).order_by(AuditEvent.policy_version))]
    runs = db.scalar(select(func.count()).select_from(Run).where(Run.workspace_id == wid, Run.started_at >= since)) or 0
    return {"days": days, "runs": runs, "allowed": sum(d["allowed"] for d in daily), "denied": sum(d["denied"] for d in daily),
            "failed": sum(d["failed"] for d in daily), "daily": daily, "by_action": by_action, "by_scenario": by_scenario,
            "top_reasons": top_reasons, "by_policy_version": by_version}