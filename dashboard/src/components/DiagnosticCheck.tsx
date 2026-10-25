import type { DiagnosticCheck } from "../api/types";

export function DiagnosticCheckItem({ check }: { check: DiagnosticCheck }) {
  return (
    <li className="check">
      <p className="check-instruction">{check.instruction}</p>
      <div className="check-meta">
        {/* `executes` is structurally false in the contract: nothing here runs
            anything on the monitored host. */}
        <span className="badge neutral" title="Advisory only">
          {check.executes ? "executes" : "not executed automatically"}
        </span>
        {check.evidence_links.length ? (
          <span className="muted">
            linked evidence: <code className="mono">{check.evidence_links.join(", ")}</code>
          </span>
        ) : null}
      </div>
    </li>
  );
}
