import type { Incident, IncidentFilters, IncidentList } from "./types";

/** Error carrying the API's documented shape (`ApiError`). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(status: number, message: string, code?: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
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

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let code: string | undefined;
  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      if (typeof body.message === "string") message = body.message;
      if (typeof body.code === "string") code = body.code;
    }
  } catch {
    // Non-JSON error body: keep the status-based message.
  }
  return new ApiError(response.status, message, code, response.headers.get("x-request-id") ?? undefined);
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
