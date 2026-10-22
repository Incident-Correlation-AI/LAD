#!/usr/bin/env python3
"""Validate contract fixtures against the canonical JSON Schemas.

Usage:
    python scripts/validate_fixtures.py contracts/fixtures contracts/schemas
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def load(path: Path) -> object:
    return json.loads(path.read_text())


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    fixtures_dir, schemas_dir = Path(argv[0]), Path(argv[1])
    failures: list[str] = []
    schemas = {}
    for path in sorted(schemas_dir.glob("*.schema.json")):
        schema = load(path)
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as exc:  # schema meta-validation
            failures.append(f"schema {path.name}: {exc}")
            print(f"FAIL schema {path.name}: {exc}", file=sys.stderr)
            continue
        schemas[path.name] = Draft202012Validator(schema, format_checker=FormatChecker())

    if failures:
        print(f"\n{len(failures)} schema failure(s)", file=sys.stderr)
        return 1

    valid_dir = fixtures_dir / "valid"
    valid_paths = sorted(
        p for p in valid_dir.glob("*.json") if not p.name.endswith(".meta.json")
    )
    for path in valid_paths:
        errors = sorted(
            schemas["event.schema.json"].iter_errors(load(path)), key=str
        )
        if errors:
            failures.append(f"{path.name}: expected valid — {errors[0].message}")
            print(f"FAIL valid {path.name}: {errors[0].message}")
        else:
            print(f"ok   valid {path.name}")

    invalid_dir = fixtures_dir / "invalid"
    invalid_paths = sorted(
        p for p in invalid_dir.glob("*.json") if not p.name.endswith(".meta.json")
    )
    for path in invalid_paths:
        meta_path = path.with_name(path.name + ".meta.json")
        if not meta_path.exists():
            failures.append(f"{path.name}: missing meta file")
            print(f"FAIL invalid {path.name}: missing meta file")
            continue
        meta = load(meta_path)
        schema_name = f"{meta.get('schema', 'event')}.schema.json"
        validator = schemas.get(schema_name)
        if validator is None:
            failures.append(f"{path.name}: unknown schema {schema_name!r}")
            print(f"FAIL invalid {path.name}: unknown schema {schema_name!r}")
            continue
        errors = sorted(validator.iter_errors(load(path)), key=str)
        if not errors:
            failures.append(f"{path.name}: expected invalid but passed")
            print(f"FAIL invalid {path.name}: expected invalid but passed")
            continue
        combined = " ".join(
            [error.message for error in errors]
            + [str(error.instance) for error in errors]
        )
        expected = meta.get("expected_reason", "")
        if expected and expected not in combined:
            failures.append(f"{path.name}: reason {expected!r} not in {combined}")
            print(f"FAIL invalid {path.name}: expected reason {expected!r}")
        else:
            print(f"ok   invalid {path.name}")

    if failures:
        print(f"\n{len(failures)} fixture failure(s)", file=sys.stderr)
        return 1

    print(f"\n{len(valid_paths)} valid, {len(invalid_paths)} invalid fixtures verified")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
