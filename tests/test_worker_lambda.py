from __future__ import annotations

import json
from datetime import datetime, timezone
import boto3
import pytest
from moto import mock_aws

import services.worker.lambda_function as worker_mod
from lad.adapters.aws.store_dynamodb import DynamoDBStore


@pytest.fixture
def mock_worker_env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("INCIDENT_TABLE", "IncidentTable")


def test_worker_lambda_handler_processes_anomalies(mock_worker_env):
    with mock_aws():
        # Setup DynamoDB
        ddb = boto3.client("dynamodb", region_name="eu-north-1")
        ddb.create_table(
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

        store = DynamoDBStore(table_name="IncidentTable")
        worker_mod._store = store

        now = datetime.now(timezone.utc).isoformat()
        events = [
            {
                "schema_version": "1.0",
                "event_id": f"evt-worker-{i:03d}",
                "event_ts": now,
                "observed_ts": now,
                "host": "web-srv-01",
                "source": "journald",
                "service": "api",
                "category": "http",
                "type": "http_5xx",
                "severity": "error",
                "message": "HTTP 500 Internal Server Error",
                "attributes": {"status_code": 500, "latency_ms": 1100},
            }
            for i in range(25)
        ]

        # SQS event wrapping the batch
        sqs_event = {
            "Records": [
                {
                    "messageId": f"msg-{i}",
                    "body": json.dumps(evt),
                }
                for i, evt in enumerate(events)
            ]
        }

        result = worker_mod.lambda_handler(sqs_event, None)
        assert result == {"batchItemFailures": []}

        # Verify incident was persisted into DynamoDB
        incidents, _ = store.list_incidents()
        assert len(incidents) >= 1
        incident = incidents[0]
        assert incident["status"] == "open"
        assert incident["severity"] in ("medium", "high", "critical")
        assert len(incident["evidence"]["supporting_event_ids"]) > 0
