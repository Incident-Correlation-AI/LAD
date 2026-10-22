from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, kw_only=True)
class Settings:
    """Runtime configuration, sourced from the documented `LAD_*` env vars."""

    collector_token: str
    admin_token: str
    mode: str = "local"
    max_batch_events: int = 100
    max_batch_bytes: int = 262144
    data_dir: Path = Path("data")
    dedup_ttl_seconds: int = 7 * 24 * 60 * 60
    version: str = "0.1.0"

    def __post_init__(self) -> None:
        if not self.collector_token or not self.admin_token:
            raise ValueError("collector and admin tokens must be non-empty")
        if self.collector_token == self.admin_token:
            raise ValueError("collector and admin tokens must differ")

    @classmethod
    def from_env(cls) -> "Settings":
        collector = os.environ.get("LAD_COLLECTOR_TOKEN", "").strip()
        admin = os.environ.get("LAD_ADMIN_TOKEN", "").strip()
        missing = [
            name
            for name, value in (
                ("LAD_COLLECTOR_TOKEN", collector),
                ("LAD_ADMIN_TOKEN", admin),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Missing required environment variables: " + ", ".join(missing)
            )

        return cls(
            collector_token=collector,
            admin_token=admin,
            mode=os.environ.get("LAD_MODE", "local"),
            max_batch_events=int(os.environ.get("LAD_MAX_BATCH_EVENTS", "100")),
            max_batch_bytes=int(os.environ.get("LAD_MAX_BATCH_BYTES", "262144")),
            data_dir=Path(os.environ.get("LAD_DATA_DIR", "data")),
            dedup_ttl_seconds=int(
                os.environ.get("LAD_DEDUP_TTL_SECONDS", str(7 * 24 * 60 * 60))
            ),
        )
