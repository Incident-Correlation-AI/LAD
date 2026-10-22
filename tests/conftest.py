from __future__ import annotations

import itertools
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from lad.adapters.local import InMemoryQueue, SQLiteStore
from lad.contracts.validation import validate_payload
from services.api.config import Settings
from services.api.main import build_app

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"

COLLECTOR_TOKEN = "test-collector-token"
ADMIN_TOKEN = "test-admin-token"


def load_fixture(name: str, fixture_dir: str = "valid") -> dict:
    path = CONTRACTS / "fixtures" / fixture_dir / name
    return json.loads(path.read_text())


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        collector_token=COLLECTOR_TOKEN,
        admin_token=ADMIN_TOKEN,
        data_dir=tmp_path,
    )


@pytest.fixture
def store(tmp_path: Path):
    instance = SQLiteStore(tmp_path / "test.sqlite3")
    yield instance
    instance.close()


@pytest.fixture
def queue() -> InMemoryQueue:
    return InMemoryQueue()


@pytest.fixture
def app(settings: Settings, store: SQLiteStore, queue: InMemoryQueue):
    return build_app(settings=settings, store=store, queue=queue)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {COLLECTOR_TOKEN}"}


@pytest.fixture
def admin_auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture
def valid_event() -> dict:
    return load_fixture("http_5xx.json")


@pytest.fixture
def incident_factory():
    counter = itertools.count()

    def make(**overrides) -> dict:
        index = next(counter)
        now = "2026-10-22T10:00:00+00:00"
        incident = {
            "incident_id": f"inc_{index:04d}",
            "schema_version": "1.0",
            "status": "open",
            "severity": "high",
            "affected_entities": [{"host": "web-01", "service": "checkout"}],
            "anomaly_score": 4.2,
            "detector": "statistical_baseline",
            "model_versions": {"baseline": "2026.10.1"},
            "windows": [],
            "evidence": {
                "supporting_event_ids": ["evt-1"],
                "contradicting_event_ids": [],
            },
            "hypotheses": [
                {
                    "statement": "Upstream dependency may be failing.",
                    "confidence": "unknown",
                    "supporting_event_ids": ["evt-1"],
                    "contradicting_event_ids": [],
                    "missing_evidence": ["dependency health metrics"],
                }
            ],
            "diagnostic_checks": [
                {
                    "instruction": "Compare 5xx rate with the last 24h baseline.",
                    "evidence_links": ["evt-1"],
                    "executes": False,
                }
            ],
            "created_at": now,
            "updated_at": now,
            "audit": [],
        }
        incident.update(overrides)
        return incident

    return make


@pytest.fixture
def assert_api_error():
    def check(response, status: int, code: str) -> dict:
        assert response.status_code == status, response.text
        body = response.json()
        errors = validate_payload(body, "api-errors.schema.json")
        assert not errors, errors
        assert body["error"]["code"] == code
        assert response.headers["X-Request-ID"] == body["error"]["request_id"]
        return body["error"]

    return check
