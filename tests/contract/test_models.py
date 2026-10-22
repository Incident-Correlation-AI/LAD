from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from lad.contracts import Event, Incident
from lad.contracts.validation import validate_payload
from tests.conftest import CONTRACTS

VALID_FIXTURES = sorted(
    p
    for p in (CONTRACTS / "fixtures" / "valid").glob("*.json")
    if not p.name.endswith(".meta.json")
)


def load(path):
    return json.loads(path.read_text())


@pytest.mark.parametrize("path", VALID_FIXTURES, ids=lambda p: p.name)
def test_event_model_round_trips_valid_fixtures(path):
    event = Event(**load(path))
    errors = validate_payload(event.model_dump(mode="json"), "event.schema.json")
    assert not errors, [error.message for error in errors]


def test_event_model_rejects_naive_timestamps():
    payload = load(CONTRACTS / "fixtures" / "valid" / "http_5xx.json")
    payload["event_ts"] = "2026-10-17T10:15:42"
    with pytest.raises(ValidationError):
        Event(**payload)


def test_event_model_preserves_unknown_fields():
    payload = load(CONTRACTS / "fixtures" / "valid" / "unknown_optional_field.json")
    dumped = Event(**payload).model_dump(mode="json")
    assert dumped["geo_region"] == "us-east-1"


def test_incident_model_round_trips_against_schema():
    payload = {
        "incident_id": "inc-1",
        "schema_version": "1.0",
        "status": "open",
        "severity": "high",
        "affected_entities": [{"host": "web-01"}],
        "anomaly_score": 3.5,
        "detector": "statistical_baseline",
        "evidence": {
            "supporting_event_ids": ["evt-1"],
            "contradicting_event_ids": [],
        },
        "hypotheses": [],
        "diagnostic_checks": [],
        "created_at": "2026-10-22T10:00:00+00:00",
        "updated_at": "2026-10-22T10:00:00+00:00",
        "audit": [],
    }
    dumped = Incident(**payload).model_dump(mode="json")
    errors = validate_payload(dumped, "incident.schema.json")
    assert not errors, [error.message for error in errors]
