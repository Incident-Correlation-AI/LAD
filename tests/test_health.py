from __future__ import annotations

from datetime import datetime


def test_health_is_unauthenticated_and_documents_its_shape(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"status", "version", "time"}
    assert body["status"] == "ok"
    assert datetime.fromisoformat(body["time"]).tzinfo is not None


def test_health_echoes_request_id(client):
    response = client.get("/api/v1/health", headers={"X-Request-ID": "abc123"})
    assert response.headers["X-Request-ID"] == "abc123"


def test_docs_are_not_exposed(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_wrong_method_returns_contract_envelope(client, assert_api_error):
    assert_api_error(client.put("/api/v1/health"), 405, "validation_failed")
