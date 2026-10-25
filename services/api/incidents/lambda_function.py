"""AWS Lambda handler for Incident read queries and lifecycle actions.

Routes:
  GET  /api/v1/incidents
  GET  /api/v1/incidents/{incident_id}
  POST /api/v1/incidents/{incident_id}/acknowledge
  POST /api/v1/incidents/{incident_id}/resolve
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure src/ is importable in Lambda packaging
_root = Path(__file__).resolve().parent
for _p in (_root / "src", _root):
    if str(_p) not in sys.path and _p.exists():
        sys.path.insert(0, str(_p))

from lad.adapters.aws.store_dynamodb import DynamoDBStore

INCIDENT_TABLE = os.environ.get("INCIDENT_TABLE", "IncidentTable")

_store: DynamoDBStore | None = None


def get_store() -> DynamoDBStore:
    global _store
    if _store is None:
        _store = DynamoDBStore(table_name=INCIDENT_TABLE)
    return _store


def _response(status_code: int, body: Any, request_id: str | None = None) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Request-Id",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    if request_id:
        headers["X-Request-ID"] = request_id
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body),
    }


def _error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    details: list[dict[str, Any]] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message, "request_id": request_id}
    if details:
        err["details"] = details
    return _response(status_code, {"error": err}, request_id=request_id)


def handle_list_incidents(params: dict[str, str], request_id: str) -> dict[str, Any]:
    status = params.get("status")
    severity = params.get("severity")
    time_from = params.get("time_from")
    time_to = params.get("time_to")
    host = params.get("host")
    cursor = params.get("cursor")

    try:
        limit = int(params.get("limit", "20"))
        limit = max(1, min(limit, 100))
    except ValueError:
        return _error_response(
            422, "validation_failed", "Invalid limit parameter", request_id=request_id
        )

    store = get_store()
    try:
        items, next_cursor = store.list_incidents(
            status=status,
            severity=severity,
            time_from=time_from,
            time_to=time_to,
            host=host,
            cursor=cursor,
            limit=limit,
        )
    except ValueError as exc:
        return _error_response(
            422, "validation_failed", f"Invalid pagination cursor: {exc}", request_id=request_id
        )

    return _response(200, {"items": list(items), "next_cursor": next_cursor}, request_id=request_id)


def handle_get_incident(incident_id: str, request_id: str) -> dict[str, Any]:
    store = get_store()
    incident = store.get_incident(incident_id)
    if incident is None:
        return _error_response(
            404, "not_found", f"Incident {incident_id} not found", request_id=request_id
        )
    return _response(200, incident, request_id=request_id)


def handle_lifecycle(incident_id: str, action: str, request_id: str) -> dict[str, Any]:
    store = get_store()
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        updated = store.update_status(incident_id, action, actor="admin", at=now_iso)
    except Exception as exc:
        return _error_response(
            500, "internal_error", f"Failed to update incident: {exc}", request_id=request_id
        )

    if updated is None:
        return _error_response(
            404, "not_found", f"Incident {incident_id} not found", request_id=request_id
        )
    return _response(200, updated, request_id=request_id)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    headers = event.get("headers") or {}
    request_id = (
        headers.get("x-request-id")
        or headers.get("X-Request-Id")
        or event.get("requestContext", {}).get("requestId")
        or uuid.uuid4().hex
    )
    http_ctx = event.get("requestContext", {}).get("http", {})
    method = http_ctx.get("method", "").upper()
    path = event.get("rawPath") or http_ctx.get("path", "")
    params = event.get("queryStringParameters") or {}
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return _response(204, {}, request_id=request_id)

    # 1. GET /api/v1/incidents
    if method == "GET" and path.rstrip("/") == "/api/v1/incidents":
        return handle_list_incidents(params, request_id)

    # Path parameter extraction fallback
    incident_id = path_params.get("incident_id")
    if not incident_id and "/api/v1/incidents/" in path:
        parts = path.split("/api/v1/incidents/")[1].split("/")
        if parts and parts[0]:
            incident_id = parts[0]

    if not incident_id:
        return _error_response(
            404, "not_found", f"Route {method} {path} not found", request_id=request_id
        )

    # 2. POST /api/v1/incidents/{incident_id}/acknowledge
    if method == "POST" and path.endswith("/acknowledge"):
        return handle_lifecycle(incident_id, "acknowledged", request_id)

    # 3. POST /api/v1/incidents/{incident_id}/resolve
    if method == "POST" and path.endswith("/resolve"):
        return handle_lifecycle(incident_id, "resolved", request_id)

    # 4. GET /api/v1/incidents/{incident_id}
    if method == "GET" and path.rstrip("/") == f"/api/v1/incidents/{incident_id}":
        return handle_get_incident(incident_id, request_id)

    return _error_response(
        404, "not_found", f"Route {method} {path} not found", request_id=request_id
    )
