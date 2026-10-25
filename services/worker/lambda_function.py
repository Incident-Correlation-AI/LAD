"""AWS Lambda SQS worker handler.

Consumes normalized log events from IncidentMainQueue, runs detection/correlation,
and persists incidents into IncidentTable.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

# Ensure src/ is importable in Lambda packaging
_root = Path(__file__).resolve().parent
for _p in (_root / "src", _root):
    if str(_p) not in sys.path and _p.exists():
        sys.path.insert(0, str(_p))

from lad.adapters.aws.store_dynamodb import DynamoDBStore
from lad.contracts.validation import validate_event

TABLE_NAME = os.environ.get("INCIDENT_TABLE") or os.environ.get("TABLE_NAME", "IncidentTable")

_store: DynamoDBStore | None = None


def get_store() -> DynamoDBStore:
    global _store
    if _store is None:
        _store = DynamoDBStore(table_name=TABLE_NAME)
    return _store


def process_event_message(raw_body: str) -> None:
    """Process a single SQS message body."""
    data = json.loads(raw_body)

    # Body could be a single event dict or a batch {"events": [...]}
    if isinstance(data, dict) and "events" in data and isinstance(data["events"], list):
        events = data["events"]
    elif isinstance(data, dict):
        events = [data]
    else:
        return

    for evt in events:
        if not isinstance(evt, dict):
            continue
        errors = validate_event(evt)
        if errors:
            print(f"Skipping contract-invalid queued event: {errors[0].message}")
            continue

        # Extension point: Detection & Correlation ML worker logic
        # When an anomaly is identified, build an Incident document and call:
        # get_store().put_incident(incident_dict)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """SQS Event Source Mapping entry point with partial batch failure reporting."""
    records = event.get("Records", [])
    failures: list[dict[str, str]] = []

    for record in records:
        message_id = record.get("messageId", "")
        body = record.get("body", "")
        try:
            process_event_message(body)
        except Exception as exc:
            print(f"Error processing record {message_id}: {exc}")
            failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}


# Alias for compatibility with handlers expecting "handler"
handler = lambda_handler
