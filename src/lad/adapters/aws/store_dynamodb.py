"""Amazon DynamoDB adapter for StorePort."""

from __future__ import annotations

import base64
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Sequence

import boto3
from botocore.exceptions import ClientError

from lad.contracts.validation import validate_incident


def _normalize_ts(value: str) -> str:
    """Canonical UTC ISO string so string comparison/sorting is correct."""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def _encode_cursor(created_at: str, incident_id: str) -> str:
    raw = f"{created_at}|{incident_id}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_cursor(cursor: str) -> tuple[str, str]:
    padded = cursor + "=" * (-len(cursor) % 4)
    created_at, _, incident_id = base64.urlsafe_b64decode(padded).decode().partition("|")
    if not created_at or not incident_id:
        raise ValueError("malformed cursor")
    return created_at, incident_id


def _normalize_incident_doc(doc: dict[str, Any], fallback_id: str = "unknown") -> dict[str, Any]:
    doc.setdefault(
        "incident_id",
        doc.get("sk", "").replace("INCIDENT#", "") or doc.get("incident_id", fallback_id),
    )
    doc.setdefault("schema_version", "1.0")
    doc.setdefault("status", doc.get("status", "open"))
    doc.setdefault("severity", doc.get("severity", "medium"))
    doc.setdefault("created_at", doc.get("created_at", "2026-10-22T00:00:00+00:00"))
    doc.setdefault("updated_at", doc.get("updated_at", doc["created_at"]))
    doc.setdefault("anomaly_score", 0.0)
    doc.setdefault("detector", doc.get("detector", "statistical_baseline"))
    doc.setdefault(
        "affected_entities",
        [{"host": doc.get("host", "unknown"), "service": None, "source": None}],
    )
    doc.setdefault("evidence", {"supporting_event_ids": [], "contradicting_event_ids": []})
    doc.setdefault("hypotheses", [])
    doc.setdefault("diagnostic_checks", [])
    doc.setdefault("audit", doc.get("audit") or [])
    return doc


class DynamoDBStore:
    """DynamoDB-backed store implementation of StorePort using single-table design."""

    def __init__(
        self,
        table_name: str | None = None,
        *,
        resource: Any = None,
        region_name: str | None = None,
    ) -> None:
        self.table_name = table_name or os.environ.get("INCIDENT_TABLE", "IncidentTable")
        self.region_name = region_name or os.environ.get("AWS_REGION", "eu-north-1")
        self.resource = resource or boto3.resource("dynamodb", region_name=self.region_name)
        self.table = self.resource.Table(self.table_name)

    # -- deduplication ----------------------------------------------------
    def claim_event_id(self, event_id: str, ttl_seconds: int) -> bool:
        """Atomic claim using DynamoDB conditional write and TTL."""
        now = int(time.time())
        expires_at = now + ttl_seconds
        item = {
            "pk": f"DEDUP#{event_id}",
            "sk": "META",
            "event_id": event_id,
            "seen_at": now,
            "ttl": expires_at,
        }
        try:
            # Condition: either item does not exist, or existing item has already expired
            self.table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(pk) OR #ttl < :now",
                ExpressionAttributeNames={"#ttl": "ttl"},
                ExpressionAttributeValues={":now": now},
            )
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                return False
            raise

    def release_event_id(self, event_id: str) -> None:
        """Release claim if enqueueing failed so event can be retried."""
        self.table.delete_item(Key={"pk": f"DEDUP#{event_id}", "sk": "META"})

    # -- incident storage -------------------------------------------------
    def put_incident(self, incident: dict[str, Any]) -> None:
        """Validate and persist an incident into DynamoDB."""
        errors = validate_incident(incident)
        if errors:
            raise ValueError(f"invalid incident: {errors[0].message}")

        created_at = _normalize_ts(incident["created_at"])
        updated_at = _normalize_ts(incident["updated_at"])
        incident_id = incident["incident_id"]
        status = incident["status"]

        item = {
            "pk": "INCIDENT",
            "sk": f"INCIDENT#{incident_id}",
            "gsi1pk": f"STATUS#{status}",
            "gsi1sk": f"{created_at}#{incident_id}",
            "incident_id": incident_id,
            "status": status,
            "severity": incident["severity"],
            "created_at": created_at,
            "updated_at": updated_at,
            "doc": json.dumps(incident),
        }
        self.table.put_item(Item=item)

    def get_incident(self, incident_id: str) -> dict[str, Any] | None:
        """Fetch an incident by its ID."""
        response = self.table.get_item(Key={"pk": "INCIDENT", "sk": f"INCIDENT#{incident_id}"})
        item = response.get("Item")
        if not item:
            return None
        if "doc" in item:
            try:
                doc = json.loads(item["doc"])
            except Exception:
                doc = dict(item)
        else:
            doc = dict(item)
        return _normalize_incident_doc(doc, incident_id)

    def list_incidents(
        self,
        *,
        status: str | None = None,
        severity: str | None = None,
        time_from: str | None = None,
        time_to: str | None = None,
        host: str | None = None,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[Sequence[dict[str, Any]], str | None]:
        """Query incidents using GSI1 for status filtering or primary table scan/query."""
        if status:
            response = self.table.query(
                IndexName="gsi1",
                KeyConditionExpression="gsi1pk = :spk",
                ExpressionAttributeValues={":spk": f"STATUS#{status}"},
                ScanIndexForward=False,  # newest first
            )
            raw_items = response.get("Items", [])
        else:
            response = self.table.query(
                KeyConditionExpression="pk = :pk AND begins_with(sk, :sk_prefix)",
                ExpressionAttributeValues={
                    ":pk": "INCIDENT",
                    ":sk_prefix": "INCIDENT#",
                },
            )
            raw_items = response.get("Items", [])

        # Parse documents and apply filters
        parsed_records: list[tuple[str, str, dict[str, Any]]] = []
        for item in raw_items:
            if "doc" in item:
                try:
                    doc = json.loads(item["doc"])
                except Exception:
                    doc = dict(item)
            else:
                doc = dict(item)
            doc = _normalize_incident_doc(doc)

            created_at_val = doc.get("created_at") or "2026-10-22T00:00:00+00:00"
            c_at = _normalize_ts(str(created_at_val))
            i_id = str(doc.get("incident_id") or "unknown")

            if status and doc.get("status") != status:
                continue
            if severity and doc.get("severity") != severity:
                continue
            if time_from and c_at < _normalize_ts(time_from):
                continue
            if time_to and c_at > _normalize_ts(time_to):
                continue
            if host:
                entities = doc.get("affected_entities", [])
                if not any(isinstance(e, dict) and e.get("host") == host for e in entities):
                    continue

            parsed_records.append((c_at, i_id, doc))

        # Sort newest first
        parsed_records.sort(key=lambda r: (r[0], r[1]), reverse=True)

        # Apply cursor pagination
        if cursor:
            c_time, c_id = _decode_cursor(cursor)
            parsed_records = [
                r for r in parsed_records if (r[0] < c_time or (r[0] == c_time and r[1] < c_id))
            ]

        results = [doc for _, _, doc in parsed_records[:limit]]
        next_cursor = None
        if len(parsed_records) > limit:
            last_created_at, last_id, _ = parsed_records[limit - 1]
            next_cursor = _encode_cursor(last_created_at, last_id)

        return results, next_cursor

    def update_status(
        self, incident_id: str, action: str, *, actor: str, at: str
    ) -> dict[str, Any] | None:
        """Apply lifecycle change idempotently and append to audit trail."""
        if action not in ("acknowledged", "resolved"):
            raise ValueError(f"unsupported lifecycle action: {action}")

        incident = self.get_incident(incident_id)
        if incident is None:
            return None

        current = incident["status"]
        unchanged = (action == "acknowledged" and current != "open") or (
            action == "resolved" and current == "resolved"
        )
        if unchanged:
            return incident

        incident["status"] = "acknowledged" if action == "acknowledged" else "resolved"
        incident["updated_at"] = at
        incident.setdefault("audit", []).append(
            {"action": action, "actor": actor, "at": at, "note": None}
        )

        # Ensure minimal schema validity for legacy records
        incident.setdefault("schema_version", "1.0")
        incident.setdefault("severity", "medium")
        incident.setdefault("affected_entities", [{"host": "unknown"}])
        incident.setdefault("anomaly_score", 0.0)
        incident.setdefault("detector", "statistical_baseline")
        incident.setdefault("evidence", {"supporting_event_ids": [], "contradicting_event_ids": []})
        incident.setdefault("hypotheses", [])
        incident.setdefault("diagnostic_checks", [])
        incident.setdefault("created_at", incident.get("updated_at") or at)

        self.put_incident(incident)
        return incident
