from __future__ import annotations

from typing import Any, Protocol, Sequence


class StorePort(Protocol):
    """Incident persistence, lifecycle, and ingestion deduplication."""

    def claim_event_id(self, event_id: str, ttl_seconds: int) -> bool:
        """Return True if newly claimed, False if already seen within TTL."""
        ...

    def release_event_id(self, event_id: str) -> None:
        """Undo a claim when the event could not be handed to the queue."""
        ...

    def put_incident(self, incident: dict[str, Any]) -> None: ...

    def get_incident(self, incident_id: str) -> dict[str, Any] | None: ...

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
    ) -> tuple[Sequence[dict[str, Any]], str | None]: ...

    def update_status(
        self, incident_id: str, action: str, *, actor: str, at: str
    ) -> dict[str, Any] | None:
        """Apply a lifecycle action, append an audit entry, return the record.

        Returns None when the incident does not exist. Must be idempotent.
        """
        ...
