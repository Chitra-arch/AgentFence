import uuid
from datetime import datetime, timezone
from sqlalchemy import JSON, ForeignKey, Integer, String, Text, UniqueConstraint, DateTime, Boolean, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

J = JSON().with_variant(JSONB(), "postgresql")
now = lambda: datetime.now(timezone.utc)
pk = lambda: mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(120))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Policy(Base):
    __tablename__ = "policies"
    id: Mapped[uuid.UUID] = pk()
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    rules: Mapped[list] = mapped_column(J)
    max_actions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[uuid.UUID] = pk()
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    actions: Mapped[list] = mapped_column(J)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Run(Base):
    __tablename__ = "scenario_runs"
    id: Mapped[uuid.UUID] = pk()
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    policy_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("policies.id", ondelete="SET NULL"), nullable=True)
    policy_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    allowed: Mapped[int] = mapped_column(Integer, default=0)
    denied: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (UniqueConstraint("run_id", "sequence"),)
    id: Mapped[uuid.UUID] = pk()
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenario_runs.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(60), index=True)
    resource: Mapped[str] = mapped_column(String(120))
    decision: Mapped[str] = mapped_column(String(10), index=True)
    reason: Mapped[str] = mapped_column(Text)
    policy_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
