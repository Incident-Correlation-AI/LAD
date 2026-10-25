from __future__ import annotations

import json
import pytest
import boto3
from moto import mock_aws

from services.api.authorizer.lambda_function import lambda_handler as authorizer_handler
from services.api.ingest.lambda_function import lambda_handler as ingest_handler
from services.api.incidents.lambda_function import lambda_handler as incidents_handler
from tests.conftest import load_fixture


@pytest.fixture
def aws_env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_REGION", "eu-north-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("MAIN_QUEUE_URL", "https://sqs.eu-north-1.amazonaws.com/123/IncidentMainQueue")
    monkeypatch.setenv("INCIDENT_TABLE", "IncidentTable")
    monkeypatch.setenv("COLLECTOR_TOKEN", "mock-collector-token")
    monkeypatch.setenv("ADMIN_TOKEN", "mock-admin-token")


@pytest.fixture
def mock_aws_infra(aws_env):
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

        # Setup SQS
        sqs = boto3.client("sqs", region_name="eu-north-1")
        resp = sqs.create_queue(QueueName="IncidentMainQueue")
        queue_url = resp["QueueUrl"]

        import services.api.ingest.lambda_function as ingest_mod
        from lad.adapters.aws.queue_sqs import SQSQueue
        from lad.adapters.aws.store_dynamodb import DynamoDBStore
        ingest_mod._store = DynamoDBStore(table_name="IncidentTable")
        ingest_mod._queue = SQSQueue(queue_url=queue_url)

        import services.api.incidents.lambda_function as incidents_mod
        incidents_mod._store = DynamoDBStore(table_name="IncidentTable")

        yield {"store": ingest_mod._store, "queue": ingest_mod._queue}


def test_authorizer_handler():
    # Collector token on batch route
    res = authorizer_handler(
        {
            "headers": {"authorization": "Bearer mock-collector-token"},
            "requestContext": {"http": {"path": "/api/v1/events/batch"}},
        },
        None,
    )
    assert res["isAuthorized"] is True

    # Collector token on admin route -> False
    res = authorizer_handler(
        {
            "headers": {"authorization": "Bearer mock-collector-token"},
            "requestContext": {"http": {"path": "/api/v1/incidents"}},
        },
        None,
    )
    assert res["isAuthorized"] is False

    # Admin token on admin route -> True
    res = authorizer_handler(
        {
            "headers": {"authorization": "Bearer mock-admin-token"},
            "requestContext": {"http": {"path": "/api/v1/incidents"}},
        },
        None,
    )
    assert res["isAuthorized"] is True


def test_ingest_health_handler(mock_aws_infra):
    event = {
        "rawPath": "/api/v1/health",
        "requestContext": {"http": {"method": "GET", "path": "/api/v1/health"}},
    }
    resp = ingest_handler(event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ok"
    assert body["mode"] == "aws"


def test_ingest_batch_handler(mock_aws_infra):
    valid_event = load_fixture("http_5xx.json")
    event = {
        "rawPath": "/api/v1/events/batch",
        "requestContext": {"http": {"method": "POST", "path": "/api/v1/events/batch"}},
        "body": json.dumps({"events": [valid_event]}),
    }
    resp = ingest_handler(event, None)
    assert resp["statusCode"] == 202
    body = json.loads(resp["body"])
    assert body["accepted"] == 1
    assert body["rejected"] == 0

    # Test idempotency (duplicate)
    resp2 = ingest_handler(event, None)
    assert resp2["statusCode"] == 202
    body2 = json.loads(resp2["body"])
    assert body2["accepted"] == 1
    assert body2["results"][0]["detail"] == "already accepted"


def test_incidents_lambda_handler(mock_aws_infra, incident_factory):
    store = mock_aws_infra["store"]
    incident = incident_factory(incident_id="inc-lambda-1", status="open", severity="high")
    store.put_incident(incident)

    # 1. List
    list_event = {
        "rawPath": "/api/v1/incidents",
        "requestContext": {"http": {"method": "GET", "path": "/api/v1/incidents"}},
    }
    resp = incidents_handler(list_event, None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert len(body["items"]) == 1
    assert body["items"][0]["incident_id"] == "inc-lambda-1"

    # 2. Get Single
    get_event = {
        "rawPath": "/api/v1/incidents/inc-lambda-1",
        "pathParameters": {"incident_id": "inc-lambda-1"},
        "requestContext": {"http": {"method": "GET", "path": "/api/v1/incidents/inc-lambda-1"}},
    }
    resp = incidents_handler(get_event, None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["incident_id"] == "inc-lambda-1"

    # 3. Acknowledge
    ack_event = {
        "rawPath": "/api/v1/incidents/inc-lambda-1/acknowledge",
        "pathParameters": {"incident_id": "inc-lambda-1"},
        "requestContext": {"http": {"method": "POST", "path": "/api/v1/incidents/inc-lambda-1/acknowledge"}},
    }
    resp = incidents_handler(ack_event, None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["status"] == "acknowledged"

    # 4. Resolve
    resolve_event = {
        "rawPath": "/api/v1/incidents/inc-lambda-1/resolve",
        "pathParameters": {"incident_id": "inc-lambda-1"},
        "requestContext": {"http": {"method": "POST", "path": "/api/v1/incidents/inc-lambda-1/resolve"}},
    }
    resp = incidents_handler(resolve_event, None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["status"] == "resolved"
