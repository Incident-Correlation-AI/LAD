import type { AuditEntry, IncidentWindow } from "../api/types";
import { formatRelative, formatTimestamp } from "../lib/format";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) {
    return <p className="muted">No lifecycle actions recorded yet.</p>;
  }
  return (
    <ol className="audit">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${entry.action}-${index}`}>
          <span className={`dot dot-${entry.action}`} aria-hidden="true" />
          <div>
            <p>
              <strong>{entry.action}</strong> by {entry.actor}{" "}
              <time dateTime={entry.at} title={formatTimestamp(entry.at)}>
                {formatRelative(entry.at)}
              </time>
            </p>
            {entry.note ? <p className="muted">{entry.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WindowTimeline({ windows }: { windows: IncidentWindow[] }) {
  if (!windows.length) {
    return <p className="muted">No observation window recorded.</p>;
  }
  return (
    <ul className="timeline">
      {windows.map((window) => (
        <li key={`${window.start}-${window.end}`}>
          <span className="timeline-bar" aria-hidden="true" />
          <div>
            <p>{formatTimestamp(window.start)}</p>
            <p className="muted">→ {formatTimestamp(window.end)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
