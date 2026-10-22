from __future__ import annotations

import json
import uuid

import pytest

from tests.conftest import CONTRACTS, load_fixture

INVALID_EVENT_REASONS = {
    "bad_depends_on.json": "invalid_field",
    "bad_schema_version.json": "unsupported_schema_version",
    "bad_severity.json": "invalid_enum",
    "bad_timestamp_format.json": "invalid_timestamp",
    "empty_host.json": "invalid_field",
    "missing_event_id.json": "missing_required_field",
    "missing_required_field.json": "missing_required_field",
    "naive_timestamp.json": "invalid_timestamp",
    "oversized_message.json": "invalid_field",
}


def test_valid_batch_is_accepted_and_queued(client, auth, queue, valid_event):
    response = client.post(
        "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
    )
    assert response.status_code == 202
    body = response.json()
    assert body["accepted"] == 1
    assert body["rejected"] == 0
    assert body["receipt_id"].startswith("rcpt_")
    assert body["results"] == [
        {
            "index": 0,
            "event_id": valid_event["event_id"],
            "status": "accepted",
        }
    ]
    assert "asynchronous" in body["note"]
    assert len(queue.messages) == 1


@pytest.mark.parametrize(
    "fixture_name",
    sorted(p.name for p in (CONTRACTS / "fixtures" / "valid").glob("*.json")),
)
def test_every_valid_fixture_is_accepted(client, auth, fixture_name):
    event = load_fixture(fixture_name)
    response = client.post(
        "/api/v1/events/batch", json={"events": [event]}, headers=auth
    )
    assert response.status_code == 202, response.text
    assert response.json()["accepted"] == 1


def test_unknown_optional_fields_are_preserved(client, auth, queue):
    event = load_fixture("unknown_optional_field.json")
    response = client.post(
        "/api/v1/events/batch", json={"events": [event]}, headers=auth
    )
    assert response.status_code == 202
    queued = json.loads(queue.messages[0])
    assert queued == event


def test_partial_acceptance_does_not_drop_valid_events(client, auth, queue, valid_event):
    invalid = load_fixture("bad_severity.json", "invalid")
    response = client.post(
        "/api/v1/events/batch",
        json={"events": [valid_event, invalid]},
        headers=auth,
    )
    assert response.status_code == 202
    body = response.json()
    assert body["accepted"] == 1
    assert body["rejected"] == 1
    assert [result["status"] for result in body["results"]] == [
        "accepted",
        "rejected",
    ]
    assert body["results"][1]["reason"] == "invalid_enum"
    assert len(queue.messages) == 1

    addendum = client.post(
        "/api/v1/events/batch", json={"events": [invalid]}, headers=auth
    )
    assert addendum.json()["accepted"] == 0


@pytest.mark.parametrize("fixture_name, reason", INVALID_EVENT_REASONS.items())
def test_invalid_event_fixtures_are_rejected_with_reason(
    client, auth, fixture_name, reason
):
    event = load_fixture(fixture_name, "invalid")
    response = client.post(
        "/api/v1/events/batch", json={"events": [event]}, headers=auth
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["accepted"] == 0
    assert body["rejected"] == 1
    assert body["results"][0]["reason"] == reason
    assert body["results"][0]["index"] == 0


def test_non_object_event_is_rejected_but_batch_succeeds(client, auth):
    response = client.post("/api/v1/events/batch", json={"events": [42]}, headers=auth)
    assert response.status_code == 202
    body = response.json()
    assert body["rejected"] == 1
    assert body["results"][0]["event_id"] is None


def test_duplicate_event_is_idempotent(client, auth, queue, valid_event):
    first = client.post(
        "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
    )
    second = client.post(
        "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
    )
    assert first.status_code == second.status_code == 202
    assert second.json()["accepted"] == 1
    assert second.json()["results"][0]["detail"] == "already accepted"
    assert len(queue.messages) == 1


def test_empty_batch_is_422(client, auth, assert_api_error):
    response = client.post("/api/v1/events/batch", json={"events": []}, headers=auth)
    error = assert_api_error(response, 422, "validation_failed")
    assert error["details"][0]["field"] == "events"


def test_wrapper_rejects_unexpected_properties(client, auth, assert_api_error, valid_event):
    response = client.post(
        "/api/v1/events/batch",
        json={"events": [valid_event], "extra": True},
        headers=auth,
    )
    error = assert_api_error(response, 422, "validation_failed")
    assert error["details"] == [
        {"field": "extra", "reason": "unexpected property"}
    ]


def test_malformed_json_is_400(client, auth, assert_api_error):
    response = client.post(
        "/api/v1/events/batch",
        content=b"{not json",
        headers={**auth, "Content-Type": "application/json"},
    )
    assert_api_error(response, 400, "validation_failed")


def test_wrapper_without_events_is_422(client, auth, assert_api_error):
    response = client.post("/api/v1/events/batch", json={"items": []}, headers=auth)
    error = assert_api_error(response, 422, "validation_failed")
    assert error["details"][0]["field"] == "events"


def test_too_many_events_is_413(client, auth, assert_api_error, valid_event):
    events = []
    for _ in range(101):
        copy = dict(valid_event)
        copy["event_id"] = str(uuid.uuid4())
        events.append(copy)
    response = client.post(
        "/api/v1/events/batch", json={"events": events}, headers=auth
    )
    assert_api_error(response, 413, "payload_too_large")


def test_oversized_body_is_413(client, auth, assert_api_error):
    payload = b'{"events":[' + b" " * (256 * 1024 + 1) + b"]}"
    response = client.post(
        "/api/v1/events/batch",
        content=payload,
        headers={**auth, "Content-Type": "application/json"},
    )
    assert_api_error(response, 413, "payload_too_large")


class _FailingQueue:
    def send(self, messages):
        raise RuntimeError("queue down")

    def receive(self, max_messages, visibility_timeout_s):
        return []

    def ack(self, handle):
        pass

    def nack(self, handle, *, retryable):
        pass


def test_queue_failure_releases_dedupe_claims(
    app, client, auth, queue, valid_event, assert_api_error
):
    app.state.queue = _FailingQueue()
    assert_api_error(
        client.post(
            "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
        ),
        503,
        "dependency_unavailable",
    )

    app.state.queue = queue
    retry = client.post(
        "/api/v1/events/batch", json={"events": [valid_event]}, headers=auth
    )
    assert retry.status_code == 202
    assert retry.json()["results"][0]["status"] == "accepted"
    assert "detail" not in retry.json()["results"][0]
    assert len(queue.messages) == 1


def test_valid_fixture_directory_contains_expected_files():
    names = {p.name for p in (CONTRACTS / "fixtures" / "valid").glob("*.json")}
    assert names == {
        "http_5xx.json",
        "journald_minimal.json",
        "unknown_optional_field.json",
        "windows_event.json",
    }
