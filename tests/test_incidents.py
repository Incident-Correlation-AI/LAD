from __future__ import annotations

from urllib.parse import quote


def seed(store, incident_factory, **overrides) -> dict:
    incident = incident_factory(**overrides)
    store.put_incident(incident)
    return incident


def test_get_incident(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    response = client.get(f"/api/v1/incidents/{incident['incident_id']}", headers=admin_auth)
    assert response.status_code == 200
    assert response.json() == incident


def test_list_filters_by_status_severity_and_host(client, store, admin_auth, incident_factory):
    seed(store, incident_factory, incident_id="a", status="open", severity="high")
    seed(
        store,
        incident_factory,
        incident_id="b",
        status="resolved",
        severity="low",
        affected_entities=[{"host": "db-01"}],
    )
    seed(store, incident_factory, incident_id="c", status="open", severity="low")

    body = client.get("/api/v1/incidents?status=open", headers=admin_auth).json()
    assert {item["incident_id"] for item in body["items"]} == {"a", "c"}

    body = client.get("/api/v1/incidents?status=open&severity=low", headers=admin_auth).json()
    assert [item["incident_id"] for item in body["items"]] == ["c"]

    body = client.get("/api/v1/incidents?host=db-01", headers=admin_auth).json()
    assert [item["incident_id"] for item in body["items"]] == ["b"]


def test_list_filters_by_time_window(client, store, admin_auth, incident_factory):
    seed(store, incident_factory, incident_id="early", created_at="2026-10-22T08:00:00+00:00")
    seed(store, incident_factory, incident_id="late", created_at="2026-10-22T12:00:00+00:00")

    body = client.get(
        "/api/v1/incidents?time_from=2026-10-22T10:00:00Z&time_to=2026-10-22T13:00:00Z",
        headers=admin_auth,
    ).json()
    assert [item["incident_id"] for item in body["items"]] == ["late"]


def test_list_orders_mixed_timestamp_notations(client, store, admin_auth, incident_factory):
    seed(store, incident_factory, incident_id="zulu", created_at="2026-10-22T10:00:00Z")
    seed(
        store,
        incident_factory,
        incident_id="offset",
        created_at="2026-10-22T09:00:00+00:00",
    )

    body = client.get("/api/v1/incidents", headers=admin_auth).json()
    assert [item["incident_id"] for item in body["items"]] == ["zulu", "offset"]


def test_pagination_cursor(client, store, admin_auth, incident_factory):
    for hour in (8, 9, 10):
        seed(
            store,
            incident_factory,
            incident_id=f"inc-{hour}",
            created_at=f"2026-10-22T{hour:02d}:00:00+00:00",
        )

    first = client.get("/api/v1/incidents?limit=2", headers=admin_auth).json()
    assert [item["incident_id"] for item in first["items"]] == ["inc-10", "inc-9"]
    assert first["next_cursor"]

    second = client.get(
        f"/api/v1/incidents?limit=2&cursor={quote(first['next_cursor'])}",
        headers=admin_auth,
    ).json()
    assert [item["incident_id"] for item in second["items"]] == ["inc-8"]
    assert second["next_cursor"] is None


def test_malformed_cursor_is_422(client, admin_auth, assert_api_error):
    response = client.get("/api/v1/incidents?cursor=not-a-cursor", headers=admin_auth)
    assert_api_error(response, 422, "validation_failed")


def test_invalid_filter_value_is_422(client, admin_auth, assert_api_error):
    response = client.get("/api/v1/incidents?status=closed", headers=admin_auth)
    assert_api_error(response, 422, "validation_failed")


def test_acknowledge_appends_audit_entry(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    response = client.post(
        f"/api/v1/incidents/{incident['incident_id']}/acknowledge",
        headers=admin_auth,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "acknowledged"
    assert len(body["audit"]) == 1
    assert body["audit"][0]["action"] == "acknowledged"
    assert body["audit"][0]["actor"] == "admin"
    assert body["audit"][0]["at"] == body["updated_at"]
    assert body["created_at"] == incident["created_at"]


def test_acknowledge_is_idempotent(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    path = f"/api/v1/incidents/{incident['incident_id']}/acknowledge"
    first = client.post(path, headers=admin_auth).json()
    second = client.post(path, headers=admin_auth)
    assert second.status_code == 200
    assert second.json()["status"] == "acknowledged"
    assert len(second.json()["audit"]) == 1
    assert second.json()["updated_at"] == first["updated_at"]


def test_resolve_from_open(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    response = client.post(
        f"/api/v1/incidents/{incident['incident_id']}/resolve", headers=admin_auth
    )
    body = response.json()
    assert body["status"] == "resolved"
    assert [entry["action"] for entry in body["audit"]] == ["resolved"]


def test_resolve_after_acknowledge(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    base = f"/api/v1/incidents/{incident['incident_id']}"
    client.post(f"{base}/acknowledge", headers=admin_auth)
    body = client.post(f"{base}/resolve", headers=admin_auth).json()
    assert body["status"] == "resolved"
    assert [entry["action"] for entry in body["audit"]] == [
        "acknowledged",
        "resolved",
    ]


def test_resolve_is_idempotent(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory)
    path = f"/api/v1/incidents/{incident['incident_id']}/resolve"
    first = client.post(path, headers=admin_auth).json()
    second = client.post(path, headers=admin_auth).json()
    assert second["status"] == "resolved"
    assert len(second["audit"]) == len(first["audit"]) == 1
    assert second["updated_at"] == first["updated_at"]


def test_acknowledge_after_resolve_is_noop(client, store, admin_auth, incident_factory):
    incident = seed(store, incident_factory, status="resolved")
    body = client.post(
        f"/api/v1/incidents/{incident['incident_id']}/acknowledge", headers=admin_auth
    ).json()
    assert body["status"] == "resolved"
    assert body["audit"] == []


def test_lifecycle_on_missing_incident_is_404(client, admin_auth, assert_api_error):
    assert_api_error(
        client.post("/api/v1/incidents/nope/acknowledge", headers=admin_auth),
        404,
        "not_found",
    )
    assert_api_error(
        client.post("/api/v1/incidents/nope/resolve", headers=admin_auth),
        404,
        "not_found",
    )


def test_invalid_limit_is_422(client, admin_auth, assert_api_error):
    assert_api_error(
        client.get("/api/v1/incidents?limit=0", headers=admin_auth),
        422,
        "validation_failed",
    )
