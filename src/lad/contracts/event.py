from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Severity = Literal["info", "warning", "error", "critical"]


class Event(BaseModel):
    """Typed mirror of contracts/schemas/event.schema.json.

    The JSON Schema is authoritative; this model is a convenience. Contract
    tests must keep the two in agreement.
    """

    model_config = ConfigDict(extra="allow", frozen=True)

    schema_version: str
    event_id: str
    event_ts: datetime
    observed_ts: datetime
    host: str
    source: str
    service: str | None = None
    category: str
    type: str
    severity: Severity
    message: str
    template: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    trace_id: str | None = None
    request_id: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    evidence_ref: str | None = None

    @field_validator("event_ts", "observed_ts")
    @classmethod
    def _must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must be timezone-aware")
        return value
