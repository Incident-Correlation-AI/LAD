from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request

from services.api.auth import Identity, require_admin
from services.api.errors import ApiError

router = APIRouter()


def _iso_utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


@router.get("/api/v1/incidents")
def list_incidents(
    request: Request,
    status: Literal["open", "acknowledged", "resolved"] | None = None,
    severity: Literal["low", "medium", "high", "critical"] | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
    host: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    _: Identity = Depends(require_admin),
) -> dict:
    store = request.app.state.store
    try:
        items, next_cursor = store.list_incidents(
            status=status,
            severity=severity,
            time_from=_iso_utc(time_from),
            time_to=_iso_utc(time_to),
            host=host,
            cursor=cursor,
            limit=limit,
        )
    except ValueError as exc:
        raise ApiError(422, "Invalid pagination cursor") from exc
    return {"items": list(items), "next_cursor": next_cursor}


@router.get("/api/v1/incidents/{incident_id}")
def get_incident(
    incident_id: str,
    request: Request,
    _: Identity = Depends(require_admin),
) -> dict:
    incident = request.app.state.store.get_incident(incident_id)
    if incident is None:
        raise ApiError(404, f"Incident {incident_id} not found")
    return incident


def _lifecycle_action(request: Request, incident_id: str, action: str) -> dict:
    updated = request.app.state.store.update_status(
        incident_id,
        action,
        actor="admin",
        at=datetime.now(timezone.utc).isoformat(),
    )
    if updated is None:
        raise ApiError(404, f"Incident {incident_id} not found")
    return updated


@router.post("/api/v1/incidents/{incident_id}/acknowledge")
def acknowledge_incident(
    incident_id: str,
    request: Request,
    _: Identity = Depends(require_admin),
) -> dict:
    return _lifecycle_action(request, incident_id, "acknowledged")


@router.post("/api/v1/incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: str,
    request: Request,
    _: Identity = Depends(require_admin),
) -> dict:
    return _lifecycle_action(request, incident_id, "resolved")
