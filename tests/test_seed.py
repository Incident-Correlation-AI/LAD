from __future__ import annotations

from datetime import datetime, timezone

from lad.contracts.validation import validate_incident
from scripts.seed_incidents import build_demo_incidents, seed_demo_incidents


def test_demo_incidents_are_contract_valid():
    incidents = build_demo_incidents(datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc))
    assert len(incidents) == 3
    for incident in incidents:
        errors = validate_incident(incident)
        assert not errors, [error.message for error in errors]


def test_seed_is_idempotent_and_readable(tmp_path):
    seed_demo_incidents(tmp_path)

    from lad.adapters.local import SQLiteStore

    store = SQLiteStore(tmp_path / "lad.sqlite3")
    try:
        first, _ = store.list_incidents(limit=100)
        assert len(first) == 3
        seed_demo_incidents(tmp_path)
        second, _ = store.list_incidents(limit=100)
        assert len(second) == 3
        ids = {item["incident_id"] for item in second}
        assert ids == {
            "inc_demo_checkout_5xx",
            "inc_demo_db_latency",
            "inc_demo_api_error_rate",
        }
    finally:
        store.close()
