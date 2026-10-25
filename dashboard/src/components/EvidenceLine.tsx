/**
 * Log-derived strings are attacker-controlled. This component renders them as
 * text nodes only — never `dangerouslySetInnerHTML`, never `href`, never eval.
 * React escapes by default; keep it that way.
 */
export function EvidenceLine({
  eventId,
  detail,
}: {
  eventId: string;
  detail?: string | null;
}) {
  return (
    <li className="evidence-line">
      <code className="mono">{eventId}</code>
      {detail ? <span className="evidence-detail">{detail}</span> : null}
    </li>
  );
}
