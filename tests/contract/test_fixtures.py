from __future__ import annotations

import json

import pytest
from jsonschema import Draft202012Validator

from lad.contracts.validation import validate_payload
from tests.conftest import CONTRACTS

SCHEMA_NAMES = ["event.schema.json", "incident.schema.json", "api-errors.schema.json"]
VALID_FIXTURES = sorted(
    p
    for p in (CONTRACTS / "fixtures" / "valid").glob("*.json")
    if not p.name.endswith(".meta.json")
)
INVALID_FIXTURES = sorted(
    p
    for p in (CONTRACTS / "fixtures" / "invalid").glob("*.json")
    if not p.name.endswith(".meta.json")
)


def load(path):
    return json.loads(path.read_text())


@pytest.mark.parametrize("name", SCHEMA_NAMES)
def test_schemas_are_themselves_valid(name):
    Draft202012Validator.check_schema(load(CONTRACTS / "schemas" / name))


@pytest.mark.parametrize("path", VALID_FIXTURES, ids=lambda p: p.name)
def test_valid_fixtures_pass_their_schema(path):
    errors = validate_payload(load(path), "event.schema.json")
    assert not errors, [error.message for error in errors]


@pytest.mark.parametrize("path", INVALID_FIXTURES, ids=lambda p: p.name)
def test_invalid_fixtures_fail_with_documented_reason(path):
    meta_path = path.with_name(path.name + ".meta.json")
    assert meta_path.exists(), f"missing meta file for {path.name}"
    meta = load(meta_path)
    schema_name = meta.get("schema", "event") + ".schema.json"

    errors = validate_payload(load(path), schema_name)
    assert errors, f"{path.name} unexpectedly passed {schema_name}"
    combined = " ".join(
        [error.message for error in errors] + [str(error.instance) for error in errors]
    )
    assert meta["expected_reason"] in combined, combined


def test_fixture_inventory_is_explicit():
    assert [p.name for p in VALID_FIXTURES] == [
        "http_5xx.json",
        "journald_minimal.json",
        "unknown_optional_field.json",
        "windows_event.json",
    ]
    assert len(INVALID_FIXTURES) == 10


def test_unknown_fields_are_accepted_and_preserved_by_the_schema():
    event = load(CONTRACTS / "fixtures" / "valid" / "unknown_optional_field.json")
    assert "geo_region" in event
    assert not validate_payload(event, "event.schema.json")
