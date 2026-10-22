from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from lad.contracts.validation import rejection_reason, validate_event
from services.api.auth import Identity, require_collector
from services.api.errors import ApiError

router = APIRouter()

RECEIPT_NOTE = (
    "Accepted events are queued for asynchronous processing; "
    "detection may not have completed."
)


@router.post("/api/v1/events/batch")
async def submit_event_batch(
    request: Request,
    _: Identity = Depends(require_collector),
) -> JSONResponse:
    settings = request.app.state.settings
    store = request.app.state.store
    queue = request.app.state.queue

    # 1. Size limit before parsing where possible (guide 03 §2.3).
    declared_length = request.headers.get("content-length")
    if declared_length and declared_length.isdigit():
        if int(declared_length) > settings.max_batch_bytes:
            raise ApiError(413, f"Batch exceeds {settings.max_batch_bytes} bytes")
    raw = await request.body()
    if len(raw) > settings.max_batch_bytes:
        raise ApiError(413, f"Batch exceeds {settings.max_batch_bytes} bytes")

    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError:
        raise ApiError(400, "Malformed JSON body")

    if not isinstance(payload, dict):
        raise ApiError(
            422,
            "Request body must be a JSON object with an 'events' array",
            details=[{"field": "<root>", "reason": "expected object"}],
        )

    details: list[dict[str, Any]] = []
    if not isinstance(payload.get("events"), list):
        details.append({"field": "events", "reason": "required array"})
    details.extend(
        {"field": key, "reason": "unexpected property"}
        for key in sorted(set(payload) - {"events"})
    )
    if details:
        raise ApiError(422, "Request body must match EventBatchRequest", details=details)

    events = payload["events"]
    if not events:
        raise ApiError(
            422,
            "Batch must contain at least one event",
            details=[{"field": "events", "reason": "at least 1 event required"}],
        )
    if len(events) > settings.max_batch_events:
        raise ApiError(413, f"Batch exceeds {settings.max_batch_events} events")

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
            newly_claimed = store.claim_event_id(
                event_id, settings.dedup_ttl_seconds
            )
        except Exception as exc:  # storage unavailable
            raise ApiError(503, "Storage unavailable") from exc

        accepted += 1
        if newly_claimed:
            to_queue.append(json.dumps(event, separators=(",", ":")).encode())
            queued_ids.append(event_id)
            results.append(
                {"index": index, "event_id": event_id, "status": "accepted"}
            )
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
        except Exception as exc:  # queue unavailable
            # Do not leave events marked "seen" when they were never queued:
            # a retry must be able to accept and enqueue them.
            for claimed_id in queued_ids:
                try:
                    store.release_event_id(claimed_id)
                except Exception:
                    pass
            raise ApiError(503, "Queue unavailable") from exc

    receipt = {
        "receipt_id": f"rcpt_{uuid.uuid4().hex}",
        "accepted": accepted,
        "rejected": rejected,
        "results": results,
        "note": RECEIPT_NOTE,
    }
    return JSONResponse(status_code=202, content=receipt)
