from __future__ import annotations

import json
import pytest
import boto3
from moto import mock_aws

from lad.adapters.aws.queue_sqs import SQSQueue
from lad.adapters.aws.store_dynamodb import DynamoDBStore


@pytest.fixture
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")


@pytest.fixture
def mock_dynamodb(aws_env):
    with mock_aws():
        client = boto3.client("dynamodb", region_name="eu-north-1")
        client.create_table(
            TableName="IncidentTable",
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
                {"AttributeName": "gsi1pk", "AttributeType": "S"},
                {"AttributeName": "gsi1sk", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "gsi1",
                    "KeySchema": [
                        {"AttributeName": "gsi1pk", "KeyType": "HASH"},
                        {"AttributeName": "gsi1sk", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        yield DynamoDBStore(table_name="IncidentTable", region_name="eu-north-1")


@pytest.fixture
def mock_sqs(aws_env):
    with mock_aws():
        sqs = boto3.client("sqs", region_name="eu-north-1")
        dlq_resp = sqs.create_queue(QueueName="IncidentDLQ")
        dlq_url = dlq_resp["QueueUrl"]
        queue_resp = sqs.create_queue(QueueName="IncidentMainQueue")
        queue_url = queue_resp["QueueUrl"]
        yield SQSQueue(queue_url=queue_url, dlq_url=dlq_url, region_name="eu-north-1")


def test_sqs_queue_send_and_receive_and_ack(mock_sqs):
    messages = [json.dumps({"event_id": f"evt-{i}"}).encode() for i in range(15)]
    mock_sqs.send(messages)

    handles = mock_sqs.receive(max_messages=10)
    assert len(handles) == 10
    body0 = mock_sqs.get_body(handles[0])
    assert b"evt-" in body0

    mock_sqs.ack(handles[0])
    # Remaining messages in queue can still be received
    remaining = mock_sqs.receive(max_messages=10)
    assert len(remaining) == 5


def test_sqs_queue_nack_dead_letter(mock_sqs):
    mock_sqs.send([b'{"test": 1}'])
    handles = mock_sqs.receive(max_messages=1)
    assert len(handles) == 1
    handle = handles[0]

    # Non-retryable nack should send to DLQ
    mock_sqs.nack(handle, retryable=False)

    # Main queue should now be empty
    assert len(mock_sqs.receive(max_messages=1)) == 0


def test_dynamodb_store_deduplication(mock_dynamodb):
    assert mock_dynamodb.claim_event_id("evt-100", ttl_seconds=3600) is True
    assert mock_dynamodb.claim_event_id("evt-100", ttl_seconds=3600) is False
    assert mock_dynamodb.claim_event_id("evt-200", ttl_seconds=3600) is True

    mock_dynamodb.release_event_id("evt-100")
    assert mock_dynamodb.claim_event_id("evt-100", ttl_seconds=3600) is True


def test_dynamodb_store_incident_crud_and_lifecycle(mock_dynamodb, incident_factory):
    incident = incident_factory(
        incident_id="inc-aws-1",
        status="open",
        severity="critical",
        affected_entities=[{"host": "web-aws-01", "service": "api"}],
    )
    mock_dynamodb.put_incident(incident)

    fetched = mock_dynamodb.get_incident("inc-aws-1")
    assert fetched is not None
    assert fetched["incident_id"] == "inc-aws-1"
    assert fetched["status"] == "open"
    assert fetched["severity"] == "critical"

    # List by status using GSI1
    items, next_cursor = mock_dynamodb.list_incidents(status="open")
    assert len(items) == 1
    assert items[0]["incident_id"] == "inc-aws-1"

    # List by host
    items_host, _ = mock_dynamodb.list_incidents(host="web-aws-01")
    assert len(items_host) == 1

    # Acknowledge lifecycle
    acked = mock_dynamodb.update_status(
        "inc-aws-1", "acknowledged", actor="admin", at="2026-10-25T14:00:00+00:00"
    )
    assert acked["status"] == "acknowledged"
    assert len(acked["audit"]) == 1
    assert acked["audit"][0]["action"] == "acknowledged"

    # Acknowledging again is idempotent
    acked_again = mock_dynamodb.update_status(
        "inc-aws-1", "acknowledged", actor="admin", at="2026-10-25T14:05:00+00:00"
    )
    assert acked_again["status"] == "acknowledged"
    assert len(acked_again["audit"]) == 1  # no duplicate audit entry

    # Resolve lifecycle
    resolved = mock_dynamodb.update_status(
        "inc-aws-1", "resolved", actor="admin", at="2026-10-25T14:10:00+00:00"
    )
    assert resolved["status"] == "resolved"
    assert len(resolved["audit"]) == 2
