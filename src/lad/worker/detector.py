"""Anomaly Detection and Correlation Engine for LAD.

Connects incoming raw event envelopes to AI-Part:
1. Normalization & Validation (parse_lad_events)
2. Windowing & Feature Extraction (build_network_windows, 39 features)
3. Anomaly Scoring (NetworkDetector Isolation Forest / Rule Baseline)
4. Evidence Assembly (maps window -> supporting event_ids)
5. Evidence Correlation & Incident Drafting (EvidenceCorrelationPipeline)
"""

from __future__ import annotations

import json
import logging
import math
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
    from anomaly_detector.network.baseline import (
        RuleConfig,
        score_window as score_baseline,
    )
    from anomaly_detector.network.features import (
        NETWORK_FEATURE_SCHEMA_VERSION,
        NetworkWindow,
        build_network_windows,
    )
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
    RuleConfig = None  # type: ignore[misc,assignment]
    score_baseline = None  # type: ignore[misc,assignment]
    NETWORK_FEATURE_SCHEMA_VERSION = "network-features-v1"
    NetworkWindow = None  # type: ignore[misc,assignment]
    build_network_windows = None  # type: ignore[misc,assignment]
    LadParseOptions = None  # type: ignore[misc,assignment]
    parse_lad_events = None  # type: ignore[misc,assignment]

try:
    from anomaly_detector.inference.detector import (
        AnomalyDetector,
        DetectorOptions,
        load_detector,
    )
except (ImportError, ModuleNotFoundError):
    AnomalyDetector = None  # type: ignore[misc,assignment]
    DetectorOptions = None  # type: ignore[misc,assignment]
    load_detector = None  # type: ignore[misc,assignment]

try:
    from anomaly_detector.network.inference import NetworkDetector, load_network_detector
except (ImportError, ModuleNotFoundError):
    NetworkDetector = None  # type: ignore[misc,assignment]
    load_network_detector = None  # type: ignore[misc,assignment]

logger = logging.getLogger(__name__)

try:
    from anomaly_detector.network.llm import EvidenceBundle as _EB, _NUMBER_RE as _NR
    _orig_eb_allowed = _EB.allowed_numbers

    def _safe_eb_allowed(self: _EB) -> set:
        nums = _orig_eb_allowed(self)
        for entity_str in (self.host_id, self.service_name, self.window_id):
            if entity_str:
                for token in _NR.findall(str(entity_str)):
                    try:
                        nums.add(float(token.rstrip("%")))
                    except ValueError:
                        pass
        return nums

    _EB.allowed_numbers = _safe_eb_allowed
except Exception:
    pass

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


def _average_path_length(n: int) -> float:
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)


def _tree_path_length(tree: dict[str, Any], x: Sequence[float]) -> float:
    features = tree["feature"]
    thresholds = tree["threshold"]
    left_children = tree["children_left"]
    right_children = tree["children_right"]
    samples = tree["n_node_samples"]
    node = 0
    depth = 0
    while features[node] >= 0:
        if x[features[node]] <= thresholds[node]:
            node = left_children[node]
        else:
            node = right_children[node]
        depth += 1
    return depth + _average_path_length(samples[node])


def score_vector_with_forest(forest: dict[str, Any], x: Sequence[float]) -> tuple[float, bool]:
    trees = forest["trees"]
    c_max = _average_path_length(forest["max_samples"])
    total_depth = sum(_tree_path_length(t, x) for t in trees)
    mean_depth = total_depth / len(trees)
    raw_score = -(2.0 ** (-mean_depth / c_max))
    threshold = float(forest.get("threshold", -0.44064863422484946))
    is_anomaly = raw_score <= threshold
    return raw_score, is_anomaly


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
                    opts = (
                        DetectorOptions(allow_external_model_path=True)
                        if DetectorOptions
                        else None
                    )
                    self.detector = (
                        load_detector(m_path, man_path, options=opts)
                        if opts
                        else load_detector(m_path, man_path)
                    )
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

        # 3. Fallback to lightweight pure-Python forest (ideal for serverless Lambda environments)
        self.forest: dict[str, Any] | None = None
        if self.detector is None:
            forest_path = pkg_model_dir / "forest.json"
            if forest_path.exists():
                try:
                    with open(forest_path, "r", encoding="utf-8") as fh:
                        self.forest = json.load(fh)
                    self.detector_kind = "forest"
                    logger.info("Loaded pure-Python IsolationForest from %s", forest_path)
                except Exception as exc:
                    logger.warning("Could not load forest.json: %s", exc)

        if self.detector is None and self.forest is None:
            logger.info("No ML model loaded. Operating in rule baseline mode.")

        llm_provider = os.getenv("LAD_LLM_PROVIDER", "mock").strip().lower()
        llm_endpoint = os.getenv("LAD_LLM_ENDPOINT", "").strip()
        llm_model = os.getenv("LAD_LLM_MODEL", "").strip()
        explain_env = os.getenv("LAD_CORRELATION_EXPLAIN", "true").lower()
        explain = explain_env in ("true", "1", "yes")

        self.correlation_pipeline = EvidenceCorrelationPipeline(
            CorrelationConfig(
                explain=explain,
                llm_provider=llm_provider,
                llm_endpoint=llm_endpoint,
                llm_model=llm_model,
                require_supporting_events=False,
            )
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
                high_delta = getattr(self.rules, "isolation_forest_high_delta", 0.10)
                mad_high_z = getattr(self.rules, "mad_high_zscore", 4.0)
                for res, win in zip(results, windows):
                    if res.status is InferenceStatus.SCORED:
                        decision = score_baseline(win.features, self.rules)
                        mad_z = max(
                            abs(win.features.get("event_count_zscore") or 0.0),
                            abs(win.features.get("http_request_count_zscore") or 0.0),
                        )
                        is_if_high = (
                            res.is_anomaly
                            and res.raw_score is not None
                            and res.threshold is not None
                            and res.raw_score <= (res.threshold - high_delta)
                        )
                        is_mad_high = mad_z >= mad_high_z
                        is_rule_high = decision.severity == "high"

                        error_count = win.features.get("error_count") or 0.0
                        auth_failures = win.features.get("auth_failure_count") or 0.0
                        restarts = win.features.get("restart_count") or 0.0
                        http_4xx = win.features.get("http_4xx_count") or 0.0
                        has_operational_fault = (
                            error_count > 0
                            or auth_failures > 0
                            or restarts > 0
                            or http_4xx > 0
                            or decision.is_anomaly
                        )

                        if not has_operational_fault:
                            res.is_anomaly = False
                            res_severity = "none"
                        elif is_rule_high:
                            res_severity = "high"
                        elif is_if_high or is_mad_high:
                            if decision.is_anomaly and decision.severity == "medium":
                                res_severity = "medium"
                            else:
                                res_severity = "high"
                        elif res.is_anomaly or decision.is_anomaly:
                            res_severity = "medium"
                        elif decision.severity:
                            res_severity = decision.severity
                        else:
                            res_severity = "none"

                        res.extra.setdefault("network", {})["severity"] = res_severity
                        res.extra["network"]["baseline"] = decision.to_dict()
                        res.extra["network"]["evidence_features"] = _build_evidence_features(
                            win.features
                        )
                return results

        if self.forest is not None:
            results: list[InferenceResult] = []
            feature_cols = self.forest.get("feature_columns", [])
            medians = self.forest.get("imputation_statistics", {})
            threshold = float(self.forest.get("threshold", -0.44064863422484946))
            high_delta = getattr(self.rules, "isolation_forest_high_delta", 0.10)
            mad_high_z = getattr(self.rules, "mad_high_zscore", 4.0)

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
                            feature_schema_version="features-v1",
                            model_name=self.forest.get("model_name", "sklearn.ensemble.IsolationForest"),
                            model_version=self.forest.get("model_version", "kaggle-tune-20261026T191658Z"),
                            model_artifact_version=self.forest.get("model_artifact_version", "1"),
                            score_direction="lower_is_more_anomalous",
                        )
                    )
                    continue

                x = [
                    float(win.features[c]) if win.features.get(c) is not None else float(medians.get(c, 0.0))
                    for c in feature_cols
                ]
                raw_score, is_anomaly = score_vector_with_forest(self.forest, x)
                decision = score_baseline(win.features, self.rules)
                mad_z = max(
                    abs(win.features.get("event_count_zscore") or 0.0),
                    abs(win.features.get("http_request_count_zscore") or 0.0),
                )
                is_if_high = is_anomaly and raw_score <= (threshold - high_delta)
                is_mad_high = mad_z >= mad_high_z
                is_rule_high = decision.severity == "high"

                error_count = win.features.get("error_count") or 0.0
                auth_failures = win.features.get("auth_failure_count") or 0.0
                restarts = win.features.get("restart_count") or 0.0
                http_4xx = win.features.get("http_4xx_count") or 0.0
                has_operational_fault = (
                    error_count > 0
                    or auth_failures > 0
                    or restarts > 0
                    or http_4xx > 0
                    or decision.is_anomaly
                )

                if not has_operational_fault:
                    is_anomaly = False
                    res_severity = "none"
                elif is_rule_high:
                    res_severity = "high"
                elif is_if_high or is_mad_high:
                    if decision.is_anomaly and decision.severity == "medium":
                        res_severity = "medium"
                    else:
                        res_severity = "high"
                elif is_anomaly or decision.is_anomaly:
                    res_severity = "medium"
                elif decision.severity:
                    res_severity = decision.severity
                else:
                    res_severity = "none"

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
                        feature_schema_version="features-v1",
                        model_name=self.forest.get("model_name", "sklearn.ensemble.IsolationForest"),
                        model_version=self.forest.get("model_version", "kaggle-tune-20261026T191658Z"),
                        model_artifact_version=self.forest.get("model_artifact_version", "1"),
                        raw_score=raw_score,
                        threshold=threshold,
                        score_direction="lower_is_more_anomalous",
                        is_anomaly=is_anomaly,
                        extra={
                            "network": {
                                "severity": res_severity,
                                "baseline": decision.to_dict(),
                                "evidence_features": _build_evidence_features(win.features),
                            }
                        },
                    )
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
