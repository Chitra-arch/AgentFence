import os, tempfile
_d = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_d}/test.db"   # isolated per test session
os.environ["JWT_SECRET"] = "t" * 48
import pytest
from fastapi.testclient import TestClient
from app.db import Base, engine
from app.main import app

@pytest.fixture
def client():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app) as c: yield c

def signup(client, email="a@example.com", pw="correct-horse-1"):
    t = client.post("/api/v1/auth/register", json={"email": email, "password": pw}).json()["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    ws = client.get("/api/v1/workspaces", headers=h).json()[0]["id"]
    sc = {s["name"]: s["id"] for s in client.get(f"/api/v1/workspaces/{ws}/scenarios", headers=h).json()}
    return h, ws, sc
