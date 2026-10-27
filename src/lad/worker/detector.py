"""Anomaly Detection and Correlation Engine for LAD.

Connects incoming raw event envelopes to AI-Part:
1. Normalization & Validation (parse_lad_events)
2. Windowing & Feature Extraction (build_network_windows, 39 features)
3. Anomaly Scoring (NetworkDetector Isolation Forest / Rule Baseline)
4. Evidence Assembly (maps window -> supporting event_ids)
5. Evidence Correlation & Incident Drafting (EvidenceCorrelationPipeline)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

try:
    from anomaly_detector.correlation import (
        CorrelationConfig,
        EvidenceCorrelationPipeline,
        WindowEvidence,
    )
    from anomaly_detector.inference.contract import (
        CONTRACT_VERSION,
        FeatureWindowRequest,
        InferenceResult,
        InferenceStatus,
        ReasonCode,
    )
    from anomaly_detector.inference.detector import AnomalyDetector, load_detector
    from anomaly_detector.network.baseline import (
        RuleConfig,
    )
    from anomaly_detector.network.baseline import (
        score_window as score_baseline,
    )
    from anomaly_detector.network.features import (
        NETWORK_FEATURE_SCHEMA_VERSION,
        NetworkWindow,
        build_network_windows,
    )
    from anomaly_detector.network.inference import NetworkDetector, load_network_detector
    from anomaly_detector.network.lad_adapter import LadParseOptions, parse_lad_events

    HAVE_ANOMALY_DETECTOR = True
except (ImportError, ModuleNotFoundError):
    HAVE_ANOMALY_DETECTOR = False
    CorrelationConfig = None  # type: ignore[misc,assignment]
    EvidenceCorrelationPipeline = None  # type: ignore[misc,assignment]
    WindowEvidence = None  # type: ignore[misc,assignment]
    CONTRACT_VERSION = "1.0"
    FeatureWindowRequest = None  # type: ignore[misc,assignment]
    InferenceResult = None  # type: ignore[misc,assignment]
    InferenceStatus = None  # type: ignore[misc,assignment]
    ReasonCode = None  # type: ignore[misc,assignment]
    AnomalyDetector = None  # type: ignore[misc,assignment]
    load_detector = None  # type: ignore[misc,assignment]
    RuleConfig = None  # type: ignore[misc,assignment]
    score_baseline = None  # type: ignore[misc,assignment]
    NETWORK_FEATURE_SCHEMA_VERSION = "network-features-v1"
    NetworkWindow = None  # type: ignore[misc,assignment]
    build_network_windows = None  # type: ignore[misc,assignment]
    NetworkDetector = None  # type: ignore[misc,assignment]
    load_network_detector = None  # type: ignore[misc,assignment]
    LadParseOptions = None  # type: ignore[misc,assignment]
    parse_lad_events = None  # type: ignore[misc,assignment]

logger = logging.getLogger(__name__)

EVIDENCE_FEATURES: list[str] = [
    "event_count",
    "error_count",
    "error_ratio",
    "http_request_count",
    "http_5xx_count",
    "http_5xx_ratio",
    "http_status_eligible_count",
    "auth_failure_count",
    "auth_success_count",
    "auth_failure_ratio",
    "auth_distinct_source_count",
    "auth_distinct_account_count",
    "db_event_count",
    "db_timeout_count",
    "db_timeout_ratio",
    "db_connection_failure_count",
    "db_connection_failure_ratio",
    "latency_sample_count",
    "mean_latency_ms",
    "p95_latency_ms",
    "p95_latency_ratio",
    "restart_count",
    "invalid_event_count",
    "duplicate_event_count",
    "out_of_order_event_count",
    "telemetry_gap_seconds",
]


def _parse_ts(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _build_evidence_features(features: Mapping[str, Any]) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    for name in EVIDENCE_FEATURES:
        val = features.get(name)
        if val is not None:
            evidence[name] = val
    return evidence


def build_evidence(
    results: Sequence[InferenceResult],
    events: Sequence[dict[str, Any]],
    limit_per_window: int = 10,
) -> dict[str, WindowEvidence]:
    """Map scored anomalous windows back to the event IDs that produced them."""
    parsed_events: list[tuple[datetime, dict[str, Any]]] = []
    for evt in events:
        if not isinstance(evt, dict):
            continue
        ts = _parse_ts(evt.get("event_ts"))
        eid = evt.get("event_id")
        if ts is not None and eid:
            parsed_events.append((ts, evt))

    evidence_map: dict[str, WindowEvidence] = {}
    for res in results:
        if res.status is not InferenceStatus.SCORED or not res.is_anomaly or res.window_id is None:
            continue
        start = _parse_ts(res.window_start)
        end = _parse_ts(res.window_end)
        if start is None or end is None:
            continue

        matching_ids: list[str] = [
            evt["event_id"]
            for ts, evt in parsed_events
            if evt.get("host") == res.host_id
            and (evt.get("service") == res.service_name or not evt.get("service"))
            and start <= ts < end
        ][:limit_per_window]

        if matching_ids:
            evidence_map[res.window_id] = WindowEvidence(
                window_id=res.window_id,
                supporting_event_ids=tuple(matching_ids),
                contradicting_event_ids=(),
            )
    return evidence_map


class AnomalyDetectionEngine:
    """End-to-end detection and correlation engine."""

    def __init__(
        self,
        model_path: str | None = None,
        manifest_path: str | None = None,
        rules: RuleConfig | None = None,
    ) -> None:
        if not HAVE_ANOMALY_DETECTOR:
            raise RuntimeError(
                "AnomalyDetectionEngine requires the 'anomaly_detector' package from AI-Part. "
                "Ensure AI-Part is installed or present in sys.path."
            )
        self.rules = rules or RuleConfig(
            http_5xx_min_requests=int(os.environ.get("LAD_RULE_5XX_MIN_REQUESTS", "5")),
            http_5xx_min_count=int(os.environ.get("LAD_RULE_5XX_MIN_COUNT", "3")),
            auth_min_events=int(os.environ.get("LAD_RULE_AUTH_MIN_EVENTS", "5")),
            auth_min_failures=int(os.environ.get("LAD_RULE_AUTH_MIN_FAILURES", "4")),
            db_min_events=int(os.environ.get("LAD_RULE_DB_MIN_EVENTS", "4")),
        )
        self.detector: AnomalyDetector | NetworkDetector | None = None
        self.detector_kind: str | None = None

        ai_part_root = Path(__file__).resolve().parents[4] / "AI-Part"
        pkg_model_dir = Path(__file__).resolve().parent / "model"
        candidate_pairs = [
            (
                str(pkg_model_dir / "model.joblib"),
                str(pkg_model_dir / "manifest.json"),
            ),
            (
                os.environ.get("LAD_MODEL_PATH")
                or str(ai_part_root / "artifacts/run_20261026T191658Z/model/model.joblib"),
                os.environ.get("LAD_MANIFEST_PATH")
                or str(ai_part_root / "artifacts/run_20261026T191658Z/model/manifest.json"),
            ),
            (
                str(ai_part_root / "artifacts/baseline/model/model.joblib"),
                str(ai_part_root / "artifacts/baseline/model/manifest.json"),
            ),
            (
                str(ai_part_root / "artifacts/network/model/model.joblib"),
                str(ai_part_root / "artifacts/network/model/manifest.json"),
            ),
        ]
        if model_path and manifest_path:
            candidate_pairs.insert(0, (model_path, manifest_path))

        for m_path, man_path in candidate_pairs:
            if os.path.exists(m_path) and os.path.exists(man_path):
                # 1. Try loading via AnomalyDetector (colleague's Kaggle-tuned model)
                try:
                    self.detector = load_detector(m_path, man_path)
                    self.detector_kind = "baseline"
                    logger.info("Loaded AnomalyDetector (colleague model) from %s", m_path)
                    break
                except Exception as exc:
                    logger.debug("Could not load as baseline AnomalyDetector: %s", exc)

                # 2. Try loading via NetworkDetector
                try:
                    self.detector = load_network_detector(
                        model_path=m_path,
                        manifest_path=man_path,
                        rules=self.rules,
                    )
                    self.detector_kind = "network"
                    logger.info("Loaded NetworkDetector from %s", m_path)
                    break
                except Exception as exc:
                    logger.debug("Could not load as NetworkDetector: %s", exc)

        if self.detector is None:
            logger.info("No ML model loaded. Operating in rule baseline mode.")

        self.correlation_pipeline = EvidenceCorrelationPipeline(
            CorrelationConfig(explain=False, require_supporting_events=False)
        )

    def score_windows(self, windows: Sequence[NetworkWindow]) -> list[InferenceResult]:
        """Score windows using the trained detector or rule baseline fallback."""
        if self.detector is not None:
            if isinstance(self.detector, NetworkDetector):
                return self.detector.score_windows(windows)
            if isinstance(self.detector, AnomalyDetector):
                requests = [
                    FeatureWindowRequest(
                        window_id=win.sample_key,
                        window_start=win.metadata.window_start,
                        window_end=win.metadata.window_end,
                        host_id=win.metadata.host_id,
                        service_name=win.metadata.service,
                        features={
                            col: win.features.get(col)
                            for col in self.detector.expected_feature_columns
                        },
                    )
                    for win in windows
                ]
                results = self.detector.score_windows(requests)
                for res, win in zip(results, windows):
                    if res.status is InferenceStatus.SCORED:
                        decision = score_baseline(win.features, self.rules)
                        res.extra.setdefault("network", {})["severity"] = decision.severity
                        res.extra["network"]["baseline"] = decision.to_dict()
                        res.extra["network"]["evidence_features"] = _build_evidence_features(
                            win.features
                        )
                return results

        # Baseline fallback scoring
        results: list[InferenceResult] = []
        for win in windows:
            start_str = win.metadata.window_start.isoformat() if win.metadata.window_start else ""
            end_str = win.metadata.window_end.isoformat() if win.metadata.window_end else ""
            event_count = win.features.get("event_count")
            if event_count in (None, 0, 0.0):
                results.append(
                    InferenceResult(
                        contract_version=CONTRACT_VERSION,
                        status=InferenceStatus.INSUFFICIENT_DATA,
                        reason_code=ReasonCode.NO_EVENTS,
                        reason="No events in window",
                        window_id=win.sample_key,
                        window_start=start_str,
                        window_end=end_str,
                        host_id=win.metadata.host_id,
                        service_name=win.metadata.service,
                        feature_schema_version=NETWORK_FEATURE_SCHEMA_VERSION,
                        model_name="rule_baseline",
                        model_version="1.0.0",
                        model_artifact_version="baseline",
                        score_direction="lower_is_more_anomalous",
                    )
                )
                continue

            decision = score_baseline(win.features, self.rules)
            results.append(
                InferenceResult(
                    contract_version=CONTRACT_VERSION,
                    status=InferenceStatus.SCORED,
                    reason_code=ReasonCode.OK,
                    reason="",
                    window_id=win.sample_key,
                    window_start=start_str,
                    window_end=end_str,
                    host_id=win.metadata.host_id,
                    service_name=win.metadata.service,
                    feature_schema_version=NETWORK_FEATURE_SCHEMA_VERSION,
                    model_name="rule_baseline",
                    model_version="1.0.0",
                    model_artifact_version="baseline",
                    raw_score=decision.raw_score,
                    threshold=-0.5,
                    score_direction="lower_is_more_anomalous",
                    is_anomaly=decision.is_anomaly,
                    extra={
                        "network": {
                            "severity": decision.severity,
                            "baseline": decision.to_dict(),
                            "evidence_features": _build_evidence_features(win.features),
                        }
                    },
                )
            )
        return results

    def process_events(self, raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Process raw canonical event envelopes, score anomalies, and return incident drafts."""
        if not raw_events:
            return []

        # 1. Parse and validate canonical LAD envelopes
        parsed = parse_lad_events(raw_events, LadParseOptions(max_events=100_000))
        if not parsed.events:
            logger.debug("No valid events parsed from batch of %d", len(raw_events))
            return []

        # 2. Aggregate into windows and extract 39 features
        windows = build_network_windows(
            parsed.events,
            window_size_minutes=1,
            quality_by_window=parsed.quality_by_window(window_size_minutes=1),
        )
        if not windows:
            return []

        # 3. Score windows
        results = self.score_windows(windows)

        # 4. Build evidence mapping (window -> event_ids)
        evidence = build_evidence(results, raw_events)

        # 5. Deterministic correlation & Incident draft generation
        outcome = self.correlation_pipeline.correlate(results, evidence)
        return outcome.incidents
