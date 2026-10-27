"""SQLite-backed local store.

TTL semantics are explicit: dedup rows carry `expires_at` and are purged
lazily on the next claim. Nothing disappears "by magic" the way DynamoDB TTL
can lag by hours; local behavior is deterministic and testable.
"""

from __future__ import annotations

import base64
import json
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from lad.contracts.validation import validate_incident


def _normalize_ts(value: str) -> str:
    """Canonical UTC ISO string so TEXT comparison/sorting is correct.

    Accepts the `Z` suffix even on Python 3.10 (fromisoformat only learned it
    in 3.11).
    """
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


class SQLiteStore:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._migrate()

    def _migrate(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id TEXT PRIMARY KEY,
                    status      TEXT NOT NULL,
                    severity    TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    updated_at  TEXT NOT NULL,
                    doc         TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at)"
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS processed_events (
                    event_id   TEXT PRIMARY KEY,
                    seen_at    REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
                """
            )

    def close(self) -> None:
        self._conn.close()

    # -- dedupe -----------------------------------------------------------
    def claim_event_id(self, event_id: str, ttl_seconds: int) -> bool:
        now = time.time()
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM processed_events WHERE expires_at < ?", (now,))
            cursor = self._conn.execute(
                "INSERT OR IGNORE INTO processed_events(event_id, seen_at, expires_at) VALUES (?, ?, ?)",
                (event_id, now, now + ttl_seconds),
            )
            return cursor.rowcount == 1

    def release_event_id(self, event_id: str) -> None:
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM processed_events WHERE event_id = ?", (event_id,))

    # -- incidents --------------------------------------------------------
    def put_incident(self, incident: dict[str, Any]) -> None:
        errors = validate_incident(incident)
        if errors:
            raise ValueError(f"invalid incident: {errors[0].message}")
        doc = json.dumps(incident)
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO incidents(incident_id, status, severity, created_at, updated_at, doc)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(incident_id) DO UPDATE SET
                    status=excluded.status,
                    severity=excluded.severity,
                    created_at=excluded.created_at,
                    updated_at=excluded.updated_at,
                    doc=excluded.doc
                """,
                (
                    incident["incident_id"],
                    incident["status"],
                    incident["severity"],
                    _normalize_ts(incident["created_at"]),
                    _normalize_ts(incident["updated_at"]),
                    doc,
                ),
            )

    def get_incident(self, incident_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT doc FROM incidents WHERE incident_id = ?", (incident_id,)
            ).fetchone()
        return json.loads(row["doc"]) if row else None

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
        clauses: list[str] = []
        params: list[Any] = []

        if status:
            clauses.append("status = ?")
            params.append(status)
        if severity:
            clauses.append("severity = ?")
            params.append(severity)
        if time_from:
            clauses.append("created_at >= ?")
            params.append(time_from)
        if time_to:
            clauses.append("created_at <= ?")
            params.append(time_to)
        if host:
            clauses.append(
                "EXISTS (SELECT 1 FROM json_each(json_extract(doc, '$.affected_entities')) je "
                "WHERE json_extract(je.value, '$.host') = ?)"
            )
            params.append(host)
        if cursor:
            created_at, incident_id = _decode_cursor(cursor)
            clauses.append("(created_at < ? OR (created_at = ? AND incident_id < ?))")
            params.extend([created_at, created_at, incident_id])

        sql = "SELECT created_at, doc FROM incidents"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC, incident_id DESC LIMIT ?"
        params.append(limit + 1)

        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()

        records = [(row["created_at"], json.loads(row["doc"])) for row in rows]
        docs = [doc for _, doc in records[:limit]]
        next_cursor = None
        if len(records) > limit:
            last_created_at, last_doc = records[limit - 1]
            next_cursor = _encode_cursor(last_created_at, last_doc["incident_id"])
        return docs, next_cursor

    def update_status(
        self, incident_id: str, action: str, *, actor: str, at: str
    ) -> dict[str, Any] | None:
        if action not in ("acknowledged", "resolved"):
            raise ValueError(f"unsupported lifecycle action: {action}")

        with self._lock, self._conn:
            row = self._conn.execute(
                "SELECT doc FROM incidents WHERE incident_id = ?", (incident_id,)
            ).fetchone()
            if row is None:
                return None

            incident = json.loads(row["doc"])
            current = incident["status"]

            # Idempotent transitions (see openapi.yaml descriptions):
            # - acknowledge on acknowledged/resolved: unchanged
            # - resolve on resolved: unchanged
            # - resolve on open/acknowledged: allowed
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

            self._conn.execute(
                "UPDATE incidents SET status = ?, updated_at = ?, doc = ? WHERE incident_id = ?",
                (
                    incident["status"],
                    _normalize_ts(incident["updated_at"]),
                    json.dumps(incident),
                    incident_id,
                ),
            )
        return incident
