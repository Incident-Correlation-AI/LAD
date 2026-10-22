from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

SUPPORTED_SCHEMA_VERSIONS = ("1.0",)


def contracts_dir() -> Path:
    """Locate the repository's contracts directory.

    `LAD_CONTRACTS_DIR` overrides for packaged/deployed layouts.
    """
    override = os.environ.get("LAD_CONTRACTS_DIR")
    if override:
        return Path(override)
    # src/lad/contracts/validation.py -> repo root
    return Path(__file__).resolve().parents[3] / "contracts"


@lru_cache(maxsize=None)
def _load_schema_cached(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text())


def load_schema(name: str) -> dict[str, Any]:
    """Load a canonical schema by file name, e.g. `event.schema.json`."""
    return _load_schema_cached(str(contracts_dir() / "schemas" / name))


def schema_validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_schema(name), format_checker=FormatChecker())


def validate_payload(payload: Mapping[str, Any], schema_name: str) -> list[ValidationError]:
    return sorted(
        schema_validator(schema_name).iter_errors(payload),
        key=lambda error: list(error.absolute_path),
    )


def validate_event(payload: Any) -> list[ValidationError]:
    return validate_payload(payload, "event.schema.json")


def validate_incident(payload: Any) -> list[ValidationError]:
    return validate_payload(payload, "incident.schema.json")


def field_path(error: ValidationError) -> str:
    return ".".join(str(part) for part in error.absolute_path) or "<root>"


def rejection_reason(error: ValidationError) -> str:
    """Map a schema error onto a short, stable ingestion rejection reason."""
    field = field_path(error)
    if error.validator == "format" and field in ("event_ts", "observed_ts"):
        return "invalid_timestamp"
    if error.validator == "required":
        return "missing_required_field"
    if error.validator == "enum":
        return "invalid_enum"
    if error.validator == "const" and field == "schema_version":
        return "unsupported_schema_version"
    if error.validator in ("type", "minLength", "maxLength"):
        return "invalid_field"
    return "schema_validation"
