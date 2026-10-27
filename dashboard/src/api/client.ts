import type { Incident, IncidentFilters, IncidentList } from "./types";

/** One field-level reason from the API's `error.details` array. */
export interface ApiErrorDetail {
  field: string;
  reason: string;
}

/** Error carrying the API's documented shape (`ApiError`). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details: ApiErrorDetail[];

  constructor(
    status: number,
    message: string,
    code?: string,
    requestId?: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /**
   * 401/403 against the incidents API almost always means the dev proxy has no
   * admin credential. Saying "you have no incidents" here would be a lie, so we
   * surface an explicit configuration error instead.
   */
  get isAuthConfigProblem(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * In all environments (local Vite proxy and Vercel edge proxy), requests
 * use the same-origin relative path `/api/...`. This ensures requests are never
 * made cross-origin directly from the browser, which would leak credentials or
 * trigger CORS issues.
 */
const BASE = "";

function parseDetails(value: unknown): ApiErrorDetail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.field !== "string" || typeof record.reason !== "string") return [];
    return [{ field: record.field, reason: record.reason }];
  });
}

/**
 * The API always answers with `{ "error": { code, message, request_id, details? } }`
 * (see `services/api/errors.py`). Reading the envelope's top level instead of
 * `error.*` silently threw away every server message, so every failure looked
 * like "Request failed with status N".
 */
async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let code: string | undefined;
  let requestId = response.headers.get("x-request-id") ?? undefined;
  let details: ApiErrorDetail[] = [];

  try {
    const body: unknown = await response.json();
    const envelope =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).error
        : undefined;
    if (envelope && typeof envelope === "object") {
      const record = envelope as Record<string, unknown>;
      if (typeof record.message === "string" && record.message.trim()) message = record.message;
      if (typeof record.code === "string") code = record.code;
      if (typeof record.request_id === "string") requestId = record.request_id;
      details = parseDetails(record.details);
    }
  } catch {
    // Non-JSON error body: keep the status-based message.
  }

  return new ApiError(response.status, message, code, requestId, details);
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

async function postJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

export function buildIncidentQuery(filters: IncidentFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.host) params.set("host", filters.host);
  if (filters.time_from) params.set("time_from", filters.time_from);
  if (filters.time_to) params.set("time_to", filters.time_to);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function fetchIncidents(
  filters: IncidentFilters,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<IncidentList> {
  return getJson<IncidentList>(`/api/v1/incidents${buildIncidentQuery(filters, cursor)}`, signal);
}

export function fetchIncident(incidentId: string, signal?: AbortSignal): Promise<Incident> {
  return getJson<Incident>(`/api/v1/incidents/${encodeURIComponent(incidentId)}`, signal);
}

export function acknowledgeIncident(incidentId: string): Promise<Incident> {
  return postJson<Incident>(`/api/v1/incidents/${encodeURIComponent(incidentId)}/acknowledge`);
}

export function resolveIncident(incidentId: string): Promise<Incident> {
  return postJson<Incident>(`/api/v1/incidents/${encodeURIComponent(incidentId)}/resolve`);
}

