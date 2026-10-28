"""Per-workspace starter content (idempotent per workspace: only called on creation)."""
from sqlalchemy.orm import Session
from .models import Policy, Scenario, Workspace

def seed_workspace(s: Session, ws: Workspace) -> None:
    rd = lambda r: {"tool": "read_document", "resource_id": r}
    s.add(Policy(workspace_id=ws.id, name="Public reads only", max_actions=3,
                 rules=[{"tool": "read_document", "resource_class": "public", "effect": "allow"}]))
    s.add_all([
        Scenario(workspace_id=ws.id, name="Public document access", actions=[rd("doc-public-1")],
                 description="Permitted read of a public synthetic document. Expect ALLOW."),
        Scenario(workspace_id=ws.id, name="Confidential document access", actions=[rd("doc-conf-1")],
                 description="Read of a confidential synthetic document. Expect DENY, no content returned."),
        Scenario(workspace_id=ws.id, name="Excessive tool actions", actions=[rd("doc-public-1")] * 5,
                 description="Five valid reads against a limit of 3. Actions 4 and 5 are denied."),
    ])
