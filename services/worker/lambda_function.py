"""AWS Lambda SQS worker handler.

Consumes normalized log events from IncidentMainQueue, runs detection/correlation
via the AnomalyDetectionEngine (AI-Part), and persists incidents into IncidentTable.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

# Ensure local packages and contracts can be imported
_root = Path(__file__).resolve().parent
if (_root / "contracts").exists():
    os.environ.setdefault("LAD_CONTRACTS_DIR", str(_root / "contracts"))
for _p in (_root / "src", _root):
    if str(_p) not in sys.path and _p.exists():
        sys.path.insert(0, str(_p))

from lad.adapters.aws.store_dynamodb import DynamoDBStore
from lad.contracts.validation import validate_event
from lad.worker.detector import AnomalyDetectionEngine

logger = logging.getLogger(__name__)

TABLE_NAME = os.environ.get("INCIDENT_TABLE") or os.environ.get("TABLE_NAME", "IncidentTable")

_store: DynamoDBStore | None = None
_engine: AnomalyDetectionEngine | None = None


def get_store() -> DynamoDBStore:
    global _store
    if _store is None:
        _store = DynamoDBStore(table_name=TABLE_NAME)
    return _store


def get_engine() -> AnomalyDetectionEngine:
    global _engine
    if _engine is None:
        _engine = AnomalyDetectionEngine()
    return _engine


def process_event_message(raw_body: str) -> list[dict[str, Any]]:
    """Process a single SQS message body and return validated events."""
    data = json.loads(raw_body)

    if isinstance(data, dict) and "events" in data and isinstance(data["events"], list):
        events = data["events"]
    elif isinstance(data, dict):
        events = [data]
    else:
        return []

    valid_events: list[dict[str, Any]] = []
    for evt in events:
        if not isinstance(evt, dict):
            continue
        errors = validate_event(evt)
        if errors:
            logger.warning("Skipping contract-invalid queued event: %s", errors[0].message)
            continue
        valid_events.append(evt)

    return valid_events


def lambda_handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """SQS Event Source Mapping entry point with partial batch failure reporting."""
    records = event.get("Records", [])
    failures: list[dict[str, str]] = []
    batch_events: list[dict[str, Any]] = []

    for record in records:
        message_id = record.get("messageId", "")
        body = record.get("body", "")
        try:
            valid_events = process_event_message(body)
            batch_events.extend(valid_events)
        except Exception as exc:
            logger.error("Error processing record %s: %s", message_id, exc)
            failures.append({"itemIdentifier": message_id})

    # Run AI-Part detection and correlation on the collected batch
    if batch_events:
        print(f"Worker received {len(records)} SQS records, {len(batch_events)} valid events")
        try:
            engine = get_engine()
            incidents = engine.process_events(batch_events)
            print(f"Detection engine produced {len(incidents)} incidents")
            store = get_store()
            for incident in incidents:
                store.put_incident(incident)
                print(
                    f"Persisted incident {incident.get('incident_id')} (severity: {incident.get('severity')})"
                )
        except Exception as exc:
            print(f"Error during anomaly detection / correlation: {exc}")
            import traceback
            traceback.print_exc()

    return {"batchItemFailures": failures}


# Alias for compatibility with handlers expecting "handler"
handler = lambda_handler
