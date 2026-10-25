import type { Hypothesis } from "../api/types";
import { ConfidenceBadge } from "./Badges";

export function HypothesisCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const isUnknown = hypothesis.confidence === "unknown";

  return (
    <article className={`card hypothesis${isUnknown ? " is-unknown" : ""}`}>
      <header>
        {/* Attacker-influenced text: rendered as a text node. */}
        <p className="hypothesis-statement">{hypothesis.statement}</p>
        <ConfidenceBadge confidence={hypothesis.confidence} />
      </header>

      <dl className="hypothesis-meta">
        <div>
          <dt>Supporting</dt>
          <dd>{hypothesis.supporting_event_ids.length}</dd>
        </div>
        <div>
          <dt>Contradicting</dt>
          <dd>{hypothesis.contradicting_event_ids.length}</dd>
        </div>
      </dl>

      <div>
        <h5>Missing evidence</h5>
        {hypothesis.missing_evidence.length ? (
          <ul className="tight">
            {hypothesis.missing_evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No gaps declared.</p>
        )}
      </div>

      {isUnknown ? (
        <p className="footnote">
          An unknown hypothesis is a valid result: the evidence gathered so far
          does not decide between explanations.
        </p>
      ) : null}
    </article>
  );
}
