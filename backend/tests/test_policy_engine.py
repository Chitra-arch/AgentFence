import pytest
from app.services.policy_engine import *

R = Rule
read_pub = Action("read_document", "doc-public-1")
read_conf = Action("read_document", "doc-conf-1")
P = lambda *rules, **kw: Policy(1, tuple(rules), **kw)

def test_allow():
    e = run_actions(P(R("read_document", "public", "allow")), [read_pub])[0]
    assert e.decision == "ALLOW" and e.result

def test_default_deny_and_no_leak():
    e = run_actions(P(R("read_document", "public", "allow")), [read_conf])[0]
    assert e.decision == "DENY" and e.result is None

def test_deny_beats_allow():
    p = P(R("read_document", "public", "allow"), R("read_document", "public", "deny"))
    assert run_actions(p, [read_pub])[0].decision == "DENY"

def test_missing_and_disabled_fail_closed():
    assert run_actions(None, [read_pub])[0].decision == "DENY"
    p = P(R("read_document", "public", "allow"), enabled=False)
    assert run_actions(p, [read_pub])[0].decision == "DENY"

def test_unknown_tool_and_delete_always_denied():
    p = P(R("delete_record", "public", "allow"))
    ev = run_actions(p, [Action("rm_rf", "doc-public-1"), Action("delete_record", "doc-public-1")])
    assert [e.decision for e in ev] == ["DENY", "DENY"]

def test_action_limit():
    p = P(R("read_document", "public", "allow"), max_actions=2)
    ev = run_actions(p, [read_pub] * 4)
    assert [e.decision for e in ev] == ["ALLOW", "ALLOW", "DENY", "DENY"]

def test_denied_never_executes():
    calls = []
    run_actions(P(), [read_conf], executor=lambda a: calls.append(a) or "x")
    assert calls == []

def test_executor_failure_not_success():
    def boom(a): raise RuntimeError("disk")
    e = run_actions(P(R("read_document", "public", "allow")), [read_pub], executor=boom)[0]
    assert e.decision == "FAILED"

def test_version_consistent_and_invalid_policy():
    ev = run_actions(Policy(7, (R("read_document", "public", "allow"),)), [read_pub] * 2)
    assert {e.policy_version for e in ev} == {7}
    with pytest.raises(InvalidPolicy):
        P(R("shell", "public", "allow"))
