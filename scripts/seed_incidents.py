"""Seed contract-valid demo incidents into the local SQLite store.

The worker that normally produces incidents does not exist yet, so the incident
endpoints would otherwise always return an empty list. Seeding is idempotent:
re-running upserts the same `inc_demo_*` documents.

Usage:
    python -m scripts.seed_incidents [--data-dir data]
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from lad.adapters.local import SQLiteStore


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def build_demo_incidents(now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)

    first_seen = now - timedelta(hours=2)
    acknowledged_at = first_seen + timedelta(minutes=12)
    resolved_created = now - timedelta(minutes=40)
    resolved_at = resolved_created + timedelta(minutes=25)

    return [
        {
            "incident_id": "inc_demo_checkout_5xx",
            "schema_version": "1.0",
            "status": "open",
            "severity": "critical",
            "affected_entities": [
                {"host": "web-01", "service": "checkout", "source": "app-nginx"}
            ],
            "anomaly_score": 6.4,
            "detector": "statistical_baseline",
            "model_versions": {"baseline": "2026.10.1"},
            "windows": [
                {
                    "start": _iso(first_seen - timedelta(minutes=5)),
                    "end": _iso(first_seen),
                }
            ],
            "evidence": {
                "supporting_event_ids": [
                    "0192f0c1-5c3e-7b2a-9f4e-0a1b2c3d4e5f",
                    "0192f0c1-5c3e-7b2a-9f4e-0a1b2c3d4e60",
                ],
                "contradicting_event_ids": [],
                "redacted_refs": ["logs/web-01/checkout-2026-10-22.log#L2041"],
            },
            "hypotheses": [
                {
                    "statement": "Checkout 5xx errors may be caused by an unhealthy payments dependency.",
                    "confidence": "medium",
                    "supporting_event_ids": ["0192f0c1-5c3e-7b2a-9f4e-0a1b2c3d4e5f"],
                    "contradicting_event_ids": [],
                    "missing_evidence": ["dependency latency metrics for db-pay-primary"],
                },
                {
                    "statement": "Cause is currently unknown; evidence is too narrow to decide.",
                    "confidence": "unknown",
                    "supporting_event_ids": [],
                    "contradicting_event_ids": [],
                    "missing_evidence": ["external dependency health checks"],
                },
            ],
            "diagnostic_checks": [
                {
                    "instruction": "Compare checkout 5xx rate with the trailing 24h baseline.",
                    "evidence_links": ["0192f0c1-5c3e-7b2a-9f4e-0a1b2c3d4e5f"],
                    "executes": False,
                },
                {
                    "instruction": "Check whether db-pay-primary shows connection saturation in the same window.",
                    "evidence_links": ["logs/web-01/checkout-2026-10-22.log#L2041"],
                    "executes": False,
                },
            ],
            "created_at": _iso(first_seen),
            "updated_at": _iso(first_seen),
            "audit": [],
        },
        {
            "incident_id": "inc_demo_db_latency",
            "schema_version": "1.0",
            "status": "acknowledged",
            "severity": "high",
            "affected_entities": [
                {"host": "db-01", "service": "payments-db", "source": "postgres"}
            ],
            "anomaly_score": 5.1,
            "detector": "isolation_forest",
            "model_versions": {"isolation_forest": "2026.10.0"},
            "windows": [],
            "evidence": {
                "supporting_event_ids": ["0192f0c2-6d4f-7c3b-af5f-1b2c3d4e5f60"],
                "contradicting_event_ids": [],
            },
            "hypotheses": [
                {
                    "statement": "Connection pool exhaustion is plausible during the observed latency spike.",
                    "confidence": "low",
                    "supporting_event_ids": ["0192f0c2-6d4f-7c3b-af5f-1b2c3d4e5f60"],
                    "contradicting_event_ids": [],
                    "missing_evidence": ["pg_stat_activity snapshot", "pool metrics"],
                }
            ],
            "diagnostic_checks": [
                {
                    "instruction": "Inspect active connection counts and wait events for the spike window.",
                    "evidence_links": ["0192f0c2-6d4f-7c3b-af5f-1b2c3d4e5f60"],
                    "executes": False,
                }
            ],
            "created_at": _iso(now - timedelta(minutes=55)),
            "updated_at": _iso(acknowledged_at),
            "audit": [
                {
                    "action": "acknowledged",
                    "actor": "admin",
                    "at": _iso(acknowledged_at),
                    "note": "On-call is investigating the database host.",
                }
            ],
        },
        {
            "incident_id": "inc_demo_api_error_rate",
            "schema_version": "1.0",
            "status": "resolved",
            "severity": "medium",
            "affected_entities": [
                {"host": "api-02", "service": "public-api", "source": "journald"}
            ],
            "anomaly_score": 3.9,
            "detector": "statistical_baseline",
            "model_versions": {"baseline": "2026.10.1"},
            "windows": [],
            "evidence": {
                "supporting_event_ids": ["0192f0c3-7e5a-7d4c-b06a-2c3d4e5f6071"],
                "contradicting_event_ids": [],
            },
            "hypotheses": [
                {
                    "statement": "A brief error-rate spike followed a deployment and has since stopped.",
                    "confidence": "high",
                    "supporting_event_ids": ["0192f0c3-7e5a-7d4c-b06a-2c3d4e5f6071"],
                    "contradicting_event_ids": [],
                    "missing_evidence": [],
                }
            ],
            "diagnostic_checks": [
                {
                    "instruction": "Confirm error rate stayed flat for 30 minutes after the rollback.",
                    "evidence_links": ["0192f0c3-7e5a-7d4c-b06a-2c3d4e5f6071"],
                    "executes": False,
                }
            ],
            "created_at": _iso(resolved_created),
            "updated_at": _iso(resolved_at),
            "audit": [
                {
                    "action": "acknowledged",
                    "actor": "admin",
                    "at": _iso(resolved_created + timedelta(minutes=5)),
                    "note": None,
                },
                {
                    "action": "resolved",
                    "actor": "admin",
                    "at": _iso(resolved_at),
                    "note": "Deployment rolled back; error rate returned to baseline.",
                },
            ],
        },
    ]


def seed_demo_incidents(data_dir: Path | str) -> list[dict]:
    store = SQLiteStore(Path(data_dir) / "lad.sqlite3")
    try:
        incidents = build_demo_incidents()
        for incident in incidents:
            store.put_incident(incident)
        return incidents
    finally:
        store.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("LAD_DATA_DIR", "data"),
        help="Directory containing lad.sqlite3 (default: $LAD_DATA_DIR or ./data)",
    )
    args = parser.parse_args(argv)

    incidents = seed_demo_incidents(args.data_dir)
    for incident in incidents:
        host = incident["affected_entities"][0]["host"]
        print(
            f"{incident['incident_id']:26} {incident['status']:12} "
            f"{incident['severity']:8} {host}"
        )
    print(f"Seeded {len(incidents)} demo incidents into {Path(args.data_dir) / 'lad.sqlite3'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
