from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer wrong-token"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Bearer "},
    ],
)
def test_missing_or_invalid_credentials_are_401(client, assert_api_error, headers):
    response = client.get("/api/v1/incidents", headers=headers)
    assert_api_error(response, 401, "unauthorized")


def test_non_ascii_credentials_are_401_not_500(client, assert_api_error):
    headers = {b"authorization": "Bearer tökén".encode("utf-8")}
    assert_api_error(
        client.get("/api/v1/incidents", headers=headers), 401, "unauthorized"
    )


def test_collector_cannot_read_incidents(client, assert_api_error, auth):
    assert_api_error(
        client.get("/api/v1/incidents", headers=auth), 403, "forbidden"
    )


def test_admin_cannot_ingest(client, assert_api_error, admin_auth, valid_event):
    response = client.post(
        "/api/v1/events/batch",
        json={"events": [valid_event]},
        headers=admin_auth,
    )
    assert_api_error(response, 403, "forbidden")


def test_collector_can_ingest_and_admin_can_read(
    client, auth, admin_auth, valid_event
):
    assert (
        client.post(
            "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
        ).status_code
        == 202
    )
    assert client.get("/api/v1/incidents", headers=admin_auth).status_code == 200


def test_unknown_incident_returns_404_envelope(client, admin_auth, assert_api_error):
    assert_api_error(
        client.get("/api/v1/incidents/does-not-exist", headers=admin_auth),
        404,
        "not_found",
    )
