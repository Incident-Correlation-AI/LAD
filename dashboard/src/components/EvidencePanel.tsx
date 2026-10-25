import type { Evidence } from "../api/types";
import { EvidenceLine } from "./EvidenceLine";

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const supporting = evidence.supporting_event_ids ?? [];
  const contradicting = evidence.contradicting_event_ids ?? [];
  const refs = evidence.redacted_refs ?? [];

  return (
    <div className="evidence">
      <div className="evidence-group">
        <h4>
          Supporting evidence <span className="count">{supporting.length}</span>
        </h4>
        {supporting.length ? (
          <ul>
            {supporting.map((id) => (
              <EvidenceLine key={id} eventId={id} />
            ))}
          </ul>
        ) : (
          <p className="muted">None recorded.</p>
        )}
      </div>

      {/* Always rendered, even when empty: citing only supporting evidence
          would not be honest about what the detector could not see. */}
      <div className="evidence-group">
        <h4>
          Contradicting evidence <span className="count">{contradicting.length}</span>
        </h4>
        {contradicting.length ? (
          <ul>
            {contradicting.map((id) => (
              <EvidenceLine key={id} eventId={id} />
            ))}
          </ul>
        ) : (
          <p className="muted">None recorded.</p>
        )}
      </div>

      {refs.length ? (
        <div className="evidence-group">
          <h4>
            Redacted references <span className="count">{refs.length}</span>
          </h4>
          <ul>
            {refs.map((ref) => (
              <EvidenceLine key={ref} eventId={ref} />
            ))}
          </ul>
        </div>
      ) : null}

      <p className="footnote">
        Raw logs are not archived by default. References point to redacted
        extracts only.
      </p>
    </div>
  );
}
