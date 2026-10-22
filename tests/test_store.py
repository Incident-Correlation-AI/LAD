from __future__ import annotations

import time

import pytest

from lad.adapters.local import SQLiteStore


def test_claim_event_id_dedupes_within_ttl(store: SQLiteStore):
    assert store.claim_event_id("evt-1", ttl_seconds=3600) is True
    assert store.claim_event_id("evt-1", ttl_seconds=3600) is False
    assert store.claim_event_id("evt-2", ttl_seconds=3600) is True


def test_claim_event_id_expires(store: SQLiteStore):
    assert store.claim_event_id("evt-1", ttl_seconds=0) is True
    time.sleep(0.01)
    assert store.claim_event_id("evt-1", ttl_seconds=0) is True


def test_release_event_id_allows_reclaim(store: SQLiteStore):
    assert store.claim_event_id("evt-1", ttl_seconds=3600) is True
    store.release_event_id("evt-1")
    assert store.claim_event_id("evt-1", ttl_seconds=3600) is True


def test_put_incident_rejects_schema_invalid_documents(store: SQLiteStore):
    with pytest.raises(ValueError):
        store.put_incident({"incident_id": "inc-bad"})


def test_update_status_returns_none_for_unknown_incident(store: SQLiteStore):
    assert (
        store.update_status(
            "missing", "acknowledged", actor="admin", at="2026-10-22T10:00:00+00:00"
        )
        is None
    )


def test_update_status_rejects_unknown_action(store: SQLiteStore):
    with pytest.raises(ValueError):
        store.update_status(
            "inc-1", "reopened", actor="admin", at="2026-10-22T10:00:00+00:00"
        )
