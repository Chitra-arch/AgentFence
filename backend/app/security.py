import os, uuid
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

_ph = PasswordHasher()

def _secret() -> str:
    s = os.getenv("JWT_SECRET", "")
    # Fail closed: never fall back to a key baked into source.
    if len(s) < 32 or s.startswith("change-me"):
        raise RuntimeError("JWT_SECRET must be set to a random value of 32+ characters")
    return s

def hash_password(p: str) -> str: return _ph.hash(p)

def verify_password(h: str, p: str) -> bool:
    try: return _ph.verify(h, p)
    except (VerifyMismatchError, InvalidHashError): return False

def make_token(uid: uuid.UUID) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=int(os.getenv("TOKEN_MINUTES", "30")))
    return jwt.encode({"sub": str(uid), "exp": exp}, _secret(), algorithm="HS256")

def read_token(tok: str) -> uuid.UUID | None:
    try: return uuid.UUID(jwt.decode(tok, _secret(), algorithms=["HS256"])["sub"])  # algorithm pinned
    except (jwt.PyJWTError, KeyError, ValueError): return None
