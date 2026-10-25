"""AWS Lambda handler for Event Ingestion and Health check.

Routes:
  POST /api/v1/events/batch
  GET  /api/v1/health
"""

from __future__ import annotations

import base64
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_root = Path(__file__).resolve().parent
if (_root / "contracts").exists():
    os.environ.setdefault("LAD_CONTRACTS_DIR", str(_root / "contracts"))
for _p in (_root / "src", _root):
    if str(_p) not in sys.path and _p.exists():
        sys.path.insert(0, str(_p))

from lad.adapters.aws.queue_sqs import SQSQueue
from lad.adapters.aws.store_dynamodb import DynamoDBStore
from lad.contracts.validation import rejection_reason, validate_event

MAX_BATCH_BYTES = int(os.environ.get("LAD_MAX_BATCH_BYTES", "262144"))
MAX_BATCH_EVENTS = int(os.environ.get("LAD_MAX_BATCH_EVENTS", "100"))
DEDUP_TTL_SECONDS = int(os.environ.get("LAD_DEDUP_TTL_SECONDS", str(7 * 24 * 60 * 60)))
MAIN_QUEUE_URL = os.environ.get("MAIN_QUEUE_URL") or os.environ.get("QUEUE_URL", "")
INCIDENT_TABLE = os.environ.get("INCIDENT_TABLE", "IncidentTable")

RECEIPT_NOTE = (
    "Accepted events are queued for asynchronous processing; "
    "detection may not have completed."
)

_store: DynamoDBStore | None = None
_queue: SQSQueue | None = None


def get_store() -> DynamoDBStore:
    global _store
    if _store is None:
        _store = DynamoDBStore(table_name=INCIDENT_TABLE)
    return _store


def get_queue() -> SQSQueue:
    global _queue
    if _queue is None:
        _queue = SQSQueue(queue_url=MAIN_QUEUE_URL)
    return _queue


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


def handle_health(request_id: str) -> dict[str, Any]:
    return _response(
        200,
        {
            "status": "ok",
            "version": "0.1.0",
            "mode": "aws",
            "time": datetime.now(timezone.utc).isoformat(),
        },
        request_id=request_id,
    )


def handle_batch_ingest(raw_body: bytes, request_id: str) -> dict[str, Any]:
    if len(raw_body) > MAX_BATCH_BYTES:
        return _error_response(
            413,
            "payload_too_large",
            f"Batch exceeds {MAX_BATCH_BYTES} bytes",
            request_id=request_id,
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _error_response(
            400, "validation_failed", "Malformed JSON body", request_id=request_id
        )

    if not isinstance(payload, dict):
        return _error_response(
            422,
            "validation_failed",
            "Request body must be a JSON object with an 'events' array",
            details=[{"field": "<root>", "reason": "expected object"}],
            request_id=request_id,
        )

    details: list[dict[str, Any]] = []
    if not isinstance(payload.get("events"), list):
        details.append({"field": "events", "reason": "required array"})
    details.extend(
        {"field": key, "reason": "unexpected property"}
        for key in sorted(set(payload) - {"events"})
    )
    if details:
        return _error_response(
            422,
            "validation_failed",
            "Request body must match EventBatchRequest",
            details=details,
            request_id=request_id,
        )

    events = payload["events"]
    if not events:
        return _error_response(
            422,
            "validation_failed",
            "Batch must contain at least one event",
            details=[{"field": "events", "reason": "at least 1 event required"}],
            request_id=request_id,
        )

    if len(events) > MAX_BATCH_EVENTS:
        return _error_response(
            413,
            "payload_too_large",
            f"Batch exceeds {MAX_BATCH_EVENTS} events",
            request_id=request_id,
        )

    store = get_store()
    queue = get_queue()

    results: list[dict[str, Any]] = []
    accepted = 0
    rejected = 0
    to_queue: list[bytes] = []
    queued_ids: list[str] = []

    for index, event in enumerate(events):
        errors = validate_event(event)
        if errors:
            rejected += 1
            first = errors[0]
            raw_id = event.get("event_id") if isinstance(event, dict) else None
            results.append(
                {
                    "index": index,
                    "event_id": raw_id if isinstance(raw_id, str) else None,
                    "status": "rejected",
                    "reason": rejection_reason(first),
                    "detail": first.message[:500],
                }
            )
            continue

        event_id = event["event_id"]
        try:
            newly_claimed = store.claim_event_id(event_id, DEDUP_TTL_SECONDS)
        except Exception:
            return _error_response(
                503, "dependency_unavailable", "Storage unavailable", request_id=request_id
            )

        accepted += 1
        if newly_claimed:
            to_queue.append(json.dumps(event, separators=(",", ":")).encode())
            queued_ids.append(event_id)
            results.append({"index": index, "event_id": event_id, "status": "accepted"})
        else:
            results.append(
                {
                    "index": index,
                    "event_id": event_id,
                    "status": "accepted",
                    "detail": "already accepted",
                }
            )

    if to_queue:
        try:
            queue.send(to_queue)
        except Exception:
            # Rollback claims so events can be retried
            for claimed_id in queued_ids:
                try:
                    store.release_event_id(claimed_id)
                except Exception:
                    pass
            return _error_response(
                503, "dependency_unavailable", "Queue unavailable", request_id=request_id
            )

    receipt = {
        "receipt_id": f"rcpt_{uuid.uuid4().hex}",
        "accepted": accepted,
        "rejected": rejected,
        "results": results,
        "note": RECEIPT_NOTE,
    }
    return _response(202, receipt, request_id=request_id)


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

    if method == "OPTIONS":
        return _response(204, {}, request_id=request_id)

    if method == "GET" and path.rstrip("/").endswith("/api/v1/health"):
        return handle_health(request_id)

    if method == "POST" and path.rstrip("/").endswith("/api/v1/events/batch"):
        body_str = event.get("body") or ""
        if event.get("isBase64Encoded"):
            raw_body = base64.b64decode(body_str)
        else:
            raw_body = body_str.encode("utf-8")
        return handle_batch_ingest(raw_body, request_id)

    return _error_response(
        404, "not_found", f"Route {method} {path} not found", request_id=request_id
    )
