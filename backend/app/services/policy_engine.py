"""Deterministic policy engine + sandbox executor (no FastAPI/DB imports).

Precedence (first match wins):
 1. missing/disabled policy      -> DENY (fail closed)
 2. tool not in EXECUTOR_ALLOWLIST -> DENY
 3. delete_record                -> DENY (always, v1)
 4. explicit deny rule matches   -> DENY (beats any allow)
 5. action limit exceeded        -> DENY
 6. explicit allow rule matches  -> ALLOW
 7. no rule matched              -> DENY (default deny)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Literal

Effect = Literal["allow", "deny"]
EXECUTOR_ALLOWLIST = frozenset({"read_document", "query_sample_records", "delete_record"})
RESOURCE_CLASSES = frozenset({"public", "internal", "confidential"})

# Synthetic resources only: id -> (resource class, content)
RESOURCES = {
    "doc-public-1": ("public", "Synthetic public handbook."),
    "doc-conf-1": ("confidential", "SYNTHETIC-CONFIDENTIAL-PAYLOAD"),
    "records-sample": ("internal", "3 synthetic rows"),
}

class InvalidPolicy(ValueError): ...

@dataclass(frozen=True)
class Rule:
    tool: str
    resource_class: str
    effect: Effect

@dataclass(frozen=True)
class Policy:
    version: int
    rules: tuple[Rule, ...]
    enabled: bool = True
    max_actions: int | None = None

    def __post_init__(self) -> None:
        for r in self.rules:
            if r.tool not in EXECUTOR_ALLOWLIST:
                raise InvalidPolicy(f"unknown tool: {r.tool}")
            if r.resource_class not in RESOURCE_CLASSES:
                raise InvalidPolicy(f"unknown resource class: {r.resource_class}")
            if r.effect not in ("allow", "deny"):
                raise InvalidPolicy(f"bad effect: {r.effect}")
        if self.max_actions is not None and self.max_actions < 0:
            raise InvalidPolicy("max_actions must be >= 0")

@dataclass(frozen=True)
class Action:
    tool: str
    resource_id: str

@dataclass
class Event:
    sequence: int
    tool: str
    resource_id: str
    decision: Literal["ALLOW", "DENY", "FAILED"]
    reason: str
    policy_version: int | None
    result: str | None = None

def evaluate(policy: Policy | None, action: Action, sequence: int) -> tuple[bool, str]:
    if policy is None or not policy.enabled:
        return False, "no active policy (fail closed)"
    if action.tool not in EXECUTOR_ALLOWLIST:
        return False, f"tool '{action.tool}' not allowlisted"
    if action.tool == "delete_record":
        return False, "delete_record is always denied in v1"
    res = RESOURCES.get(action.resource_id)
    if res is None:
        return False, f"unknown resource '{action.resource_id}'"
    rclass = res[0]
    matches = [r for r in policy.rules if r.tool == action.tool and r.resource_class == rclass]
    if any(r.effect == "deny" for r in matches):
        return False, f"explicit deny: {action.tool} on {rclass}"
    if policy.max_actions is not None and sequence > policy.max_actions:
        return False, f"action limit {policy.max_actions} exceeded"
    if any(r.effect == "allow" for r in matches):
        return True, f"explicit allow: {action.tool} on {rclass}"
    return False, "default deny: no matching rule"

def _execute(action: Action) -> str:
    # Narrow allowlisted operations over synthetic data only.
    return RESOURCES[action.resource_id][1]

def run_actions(policy: Policy | None, actions: list[Action],
                executor: Callable[[Action], str] = _execute) -> list[Event]:
    """Evaluate against ONE policy snapshot; denied actions never reach executor."""
    events: list[Event] = []
    version = policy.version if policy else None
    for i, a in enumerate(actions, start=1):
        ok, reason = evaluate(policy, a, i)
        if not ok:
            events.append(Event(i, a.tool, a.resource_id, "DENY", reason, version))
            continue
        try:
            events.append(Event(i, a.tool, a.resource_id, "ALLOW", reason, version, executor(a)))
        except Exception as exc:  # never report a failed execution as success
            events.append(Event(i, a.tool, a.resource_id, "FAILED", f"executor error: {exc}", version))
    return events
