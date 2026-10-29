from .conftest import signup

def run(client, h, sid): return client.post(f"/api/v1/scenarios/{sid}/runs", headers=h).json()
def evs(client, h, rid): return client.get(f"/api/v1/runs/{rid}/events", headers=h).json()

def test_auth_flow_and_401(client):
    assert client.get("/api/v1/workspaces").status_code == 401
    assert client.get("/api/v1/workspaces", headers={"Authorization": "Bearer junk"}).status_code == 401
    h, *_ = signup(client)
    assert client.get("/api/v1/auth/me", headers=h).json()["email"] == "a@example.com"
    assert client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "wrong-pass-123"}).status_code == 401
    assert client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "correct-horse-1"}).status_code == 409
    assert client.post("/api/v1/auth/register", json={"email": "b@example.com", "password": "short"}).status_code == 422

def test_public_allowed_confidential_denied(client):
    h, ws, sc = signup(client)
    e = evs(client, h, run(client, h, sc["Public document access"])["id"])
    assert [x["decision"] for x in e] == ["ALLOW"]
    r = run(client, h, sc["Confidential document access"])
    assert [x["decision"] for x in evs(client, h, r["id"])] == ["DENY"]
    assert "SYNTHETIC-CONFIDENTIAL" not in client.get(f"/api/v1/runs/{r['id']}/report?format=csv", headers=h).text

def test_action_limit(client):
    h, ws, sc = signup(client)
    r = run(client, h, sc["Excessive tool actions"])
    assert [x["decision"] for x in evs(client, h, r["id"])] == ["ALLOW"] * 3 + ["DENY"] * 2
    assert (r["allowed"], r["denied"]) == (3, 2)

def test_disabled_policy_fails_closed(client):
    h, ws, sc = signup(client)
    pid = client.get(f"/api/v1/workspaces/{ws}/policies", headers=h).json()[0]["id"]
    client.patch(f"/api/v1/policies/{pid}/status", json={"enabled": False}, headers=h)
    r = run(client, h, sc["Public document access"])
    assert r["policy_version"] is None and r["denied"] == 1

def test_policy_update_bumps_version_and_rejects_invalid(client):
    h, ws, _ = signup(client)
    p = client.get(f"/api/v1/workspaces/{ws}/policies", headers=h).json()[0]
    ok = {"name": "n", "rules": [{"tool": "read_document", "resource_class": "internal", "effect": "allow"}]}
    assert client.put(f"/api/v1/policies/{p['id']}", json=ok, headers=h).json()["version"] == p["version"] + 1
    bad = {"name": "n", "rules": [{"tool": "shell", "resource_class": "public", "effect": "allow"}]}
    assert client.put(f"/api/v1/policies/{p['id']}", json=bad, headers=h).status_code == 422

def test_workspace_isolation(client):
    ha, wa, sa = signup(client, "a@example.com")
    hb, wb, _ = signup(client, "b@example.com")
    rid = run(client, ha, sa["Public document access"])["id"]
    pid = client.get(f"/api/v1/workspaces/{wa}/policies", headers=ha).json()[0]["id"]
    for url in [f"/api/v1/workspaces/{wa}/policies", f"/api/v1/workspaces/{wa}/scenarios",
                f"/api/v1/workspaces/{wa}/audit-events", f"/api/v1/scenarios/{sa['Public document access']}",
                f"/api/v1/runs/{rid}", f"/api/v1/runs/{rid}/events", f"/api/v1/runs/{rid}/report?format=json",
                f"/api/v1/policies/{pid}"]:
        assert client.get(url, headers=hb).status_code == 404, url
    assert client.post(f"/api/v1/scenarios/{sa['Public document access']}/runs", headers=hb).status_code == 404
    assert client.patch(f"/api/v1/policies/{pid}/status", json={"enabled": False}, headers=hb).status_code == 404
    assert client.get(f"/api/v1/workspaces/{wb}/audit-events", headers=hb).json()["total"] == 0

def test_report_matches_audit_and_filters(client):
    h, ws, sc = signup(client)
    r = run(client, h, sc["Excessive tool actions"])
    rep = client.get(f"/api/v1/runs/{r['id']}/report?format=json", headers=h).json()
    assert rep["events"] == evs(client, h, r["id"])
    csv_lines = client.get(f"/api/v1/runs/{r['id']}/report?format=csv", headers=h).text.strip().splitlines()
    assert len(csv_lines) == 1 + len(rep["events"])
    a = client.get(f"/api/v1/workspaces/{ws}/audit-events?decision=DENY&limit=1", headers=h).json()
    assert a["total"] == 2 and len(a["items"]) == 1

def test_runs_list_scoped(client):
    ha, wa, sa = signup(client, "a@example.com")
    hb, wb, _ = signup(client, "b@example.com")
    run(client, ha, sa["Public document access"])
    assert client.get(f"/api/v1/workspaces/{wa}/runs", headers=ha).json()["total"] == 1
    assert client.get(f"/api/v1/workspaces/{wa}/runs", headers=hb).status_code == 404


def test_analytics_matches_events_and_is_scoped(client):
    ha, wa, sa = signup(client, "a@example.com")
    hb, *_ = signup(client, "b@example.com")
    run(client, ha, sa["Public document access"]); run(client, ha, sa["Confidential document access"])
    a = client.get(f"/api/v1/workspaces/{wa}/analytics?days=7", headers=ha).json()
    assert (a["runs"], a["allowed"], a["denied"], a["failed"]) == (2, 1, 1, 0)
    assert len(a["daily"]) == 7 and a["daily"][-1]["allowed"] == 1 and a["daily"][-1]["denied"] == 1
    assert a["by_action"][0]["action"] == "read_document" and len(a["by_scenario"]) == 2
    assert a["top_reasons"][0]["count"] == 1 and a["by_policy_version"][0]["version"] == 1
    assert client.get(f"/api/v1/workspaces/{wa}/analytics", headers=hb).status_code == 404
    assert client.get(f"/api/v1/workspaces/{wa}/analytics?days=0", headers=ha).status_code == 422