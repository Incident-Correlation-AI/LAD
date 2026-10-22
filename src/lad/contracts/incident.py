from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["open", "acknowledged", "resolved"]
ImpactSeverity = Literal["low", "medium", "high", "critical"]
Confidence = Literal["low", "medium", "high", "unknown"]
AuditAction = Literal["acknowledged", "resolved", "reopened"]


class AffectedEntity(BaseModel):
    model_config = ConfigDict(extra="allow")
    host: str
    service: str | None = None
    source: str | None = None


class Window(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: datetime
    end: datetime


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    supporting_event_ids: list[str]
    contradicting_event_ids: list[str]
    redacted_refs: list[str] = Field(default_factory=list)


class Hypothesis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    statement: str
    confidence: Confidence
    supporting_event_ids: list[str]
    contradicting_event_ids: list[str]
    missing_evidence: list[str]


class DiagnosticCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instruction: str
    evidence_links: list[str]
    executes: Literal[False] = False


class AuditEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: AuditAction
    actor: str
    at: datetime
    note: str | None = None


class Incident(BaseModel):
    """Typed mirror of contracts/schemas/incident.schema.json."""

    model_config = ConfigDict(extra="allow")

    incident_id: str
    schema_version: str
    status: Status
    severity: ImpactSeverity
    affected_entities: list[AffectedEntity]
    anomaly_score: float
    detector: str
    model_versions: dict[str, str] = Field(default_factory=dict)
    windows: list[Window] = Field(default_factory=list)
    evidence: Evidence
    hypotheses: list[Hypothesis] = Field(default_factory=list)
    diagnostic_checks: list[DiagnosticCheck] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    audit: list[AuditEntry] = Field(default_factory=list)
