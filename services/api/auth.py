from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import Request

from services.api.errors import ApiError


@dataclass(frozen=True)
class Identity:
    role: str


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def _matches(token: str, expected: str) -> bool:
    # Compare bytes: compare_digest(str, str) raises TypeError on non-ASCII
    # input, which would turn a malformed credential into a 500.
    return hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


def authenticate(request: Request) -> Identity:
    """Resolve the caller's role. Missing/invalid -> 401."""
    token = _bearer_token(request)
    if token is None:
        raise ApiError(401, "Missing bearer credential")
    settings = request.app.state.settings
    if _matches(token, settings.collector_token):
        return Identity(role="collector")
    if _matches(token, settings.admin_token):
        return Identity(role="admin")
    raise ApiError(401, "Invalid bearer credential")


def require_collector(request: Request) -> Identity:
    identity = authenticate(request)
    if identity.role != "collector":
        raise ApiError(403, "Collector credential required")
    return identity


def require_admin(request: Request) -> Identity:
    identity = authenticate(request)
    if identity.role != "admin":
        raise ApiError(403, "Administrator credential required")
    return identity
