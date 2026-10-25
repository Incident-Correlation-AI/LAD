# Log Anomaly Detector — API service (local lane)

FastAPI backend for ingesting normalized log events and serving anomaly
incidents. The JSON Schema and OpenAPI documents in `contracts/` are the
authoritative contract; tests enforce code/contract parity.

## Layout

```
src/lad/contracts/     Pydantic mirrors + JSON Schema validation (no HTTP)
src/lad/ports/         Interfaces: queue, store, clock
src/lad/adapters/local Concrete local implementations (files, SQLite)
services/api/          FastAPI app: config, auth, errors, routers
dashboard/             React + TypeScript dashboard (contract consumer only)
tests/                 API, adapter, and contract tests
scripts/               Fixture validator used by `make contract`
contracts/             Canonical schemas, OpenAPI, fixtures, ADR
```

This split keeps `src/lad` free of FastAPI/AWS imports so the same logic can run
inside a worker. `services/api` injects concrete adapters at startup
(`build_app(store=..., queue=...)`).

## Quickstart

```bash
make setup                       # .venv + editable install with dev extras
cp .env.example .env             # then set real tokens in .env
make seed                        # optional: 3 demo incidents (no worker yet)
make local-up                    # http://127.0.0.1:8080
```

`LAD_COLLECTOR_TOKEN` and `LAD_ADMIN_TOKEN` are required and must differ.

## Local data

There is no database server. The local lane uses files under `LAD_DATA_DIR`
(default `data/`):

| Path | Purpose |
|---|---|
| `data/lad.sqlite3` | incidents + ingestion dedupe table (SQLite, WAL mode) |
| `data/queue/*.json` | accepted events waiting for the worker |
| `data/queue/dead/` | messages that failed permanently |

Nothing consumes the queue or creates incidents yet, so `make seed` exists to
populate the incident endpoints for demos.

## Endpoints

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/health` | none |
| POST | `/api/v1/events/batch` | collector |
| GET | `/api/v1/incidents` | admin |
| GET | `/api/v1/incidents/{id}` | admin |
| POST | `/api/v1/incidents/{id}/acknowledge` | admin |
| POST | `/api/v1/incidents/{id}/resolve` | admin |

Example:

```bash
jq '{events: [.]}' contracts/fixtures/valid/http_5xx.json > /tmp/batch.json
curl -s -X POST http://127.0.0.1:8080/api/v1/events/batch \
  -H "Authorization: Bearer $LAD_COLLECTOR_TOKEN" \
  -H "Content-Type: application/json" --data @/tmp/batch.json
```

## Behavior guarantees

- **Partial acceptance:** each event is validated independently. Invalid events
  are rejected with a reason; valid ones in the same batch are still accepted.
- **`202` means queued, not analyzed.** Detection runs asynchronously.
- **Idempotency:** `event_id` is the dedupe key. A duplicate returns
  `accepted` with `detail: "already accepted"` and is not enqueued twice.
- **Limits:** 1–100 events and max 256 KiB per request (HTTP 413 for oversized).
- **Auth boundaries:** missing/bad token → 401; wrong role → 403.
- **Errors:** always `{"error": {"code", "message", "request_id", "details?"}}`
  per `contracts/schemas/api-errors.schema.json`.
- **Lifecycle:** acknowledge/resolve are idempotent and append audit entries;
  no silent mutations.

## Checks

```bash
make lint       # ruff (undefined names, unused imports, import order)
make test       # lint + full pytest suite
make contract   # lint + fixture validation + OpenAPI validation + contract tests
make smoke      # real server on a temp DB: health, ingest, list, lifecycle
```

## Dashboard

React + TypeScript (Vite, MUI 7, React Query, React Router, Recharts). It is a
**pure consumer of `contracts/openapi.yaml`**: no detection logic, no
authorization decisions, and no credentials in the bundle.

```bash
make dashboard-install   # npm install
make dashboard           # http://localhost:5173 (API must be on :8080)
make dashboard-test      # component tests (loading/error/empty, XSS, lifecycle)
make dashboard-check     # build + assert the bundle carries no credentials
```

Screens:

- **Incidents** (`/`) — summary cards (open / acknowledged / resolved /
  critical+high), a severity bar chart, URL-driven filters, cursor pagination.
- **Incident detail** (`/incidents/{id}`) — evidence in both directions,
  hypotheses with support strength, non-executing diagnostic checks, audit
  trail, acknowledge/resolve.

There is no sidebar and no health page: the product has two screens, so
navigation chrome would be furniture with nothing to hold. API liveness is
covered by `GET /api/v1/health` for operators and probes, not by the UI.

Summary counts are capped: each status is counted from at most one page of 100,
and a `next_cursor` renders as `100+` instead of asserting an exact number the
API never proved.

### Design system

The light "ceramic sand + nile blue" theme is shared with the student
mark-management dashboard, so both products read as one family:

| Concern | Location |
|---|---|
| Palette (10 shades × 7 families) | `src/theme/customColors.ts` |
| Heading/body fonts (Space Grotesk, Inter) | `src/theme/fonts.ts` |
| MUI theme + `theme.custom` augmentation | `src/theme/ThemeProvider.tsx` |
| Top bar + centred 1240px page frame | `src/components/TopBar.tsx`, `src/App.tsx` |

Surfaces are deliberately separated — an off-white canvas (`#F4F1EC`), pure
white cards, a single hairline (`#E6E0D4`) — with one 12px radius token. Cards
that share the canvas colour read as shapeless blobs, which is why opacity
tints rather than gradients/spines do the accenting here.

Accent colours are read as `theme.custom.nileBlue600`, never inline hex. The
three surface neutrals (`canvas`, `surface`, `line`) are declared once in
`ThemeProvider.tsx` so they cannot drift between cards.

### How the dashboard authenticates (and why there is no token in the bundle)

The incidents API requires an admin bearer token, and the browser must never
hold it. The Vite **dev server** injects the header into proxied requests:

```
browser → /api/... → vite dev server (+ Authorization) → 127.0.0.1:8080
```

`LAD_ADMIN_TOKEN` is read from `dashboard/.env.local` or the repo-root `.env` at
dev-server start, so it is never part of `dist/`. Same-origin also means no CORS
configuration is needed. Restart `npm run dev` after changing the token.

Because of that, a 401/403 is shown as "Dashboard is not authenticated" rather
than as an empty incident list — an empty list must never be confused with an
authentication failure.

Non-local deployments need a real credential exchange (Cognito or a BFF); that
is a pending decision, not something the bundle should solve.

## Notes for the next service (worker)

- Re-validate queued events; the queue is at-least-once.
- Persist incidents through `StorePort.put_incident`, which validates against
  `incident.schema.json`.
- Keep timestamps timezone-aware; `event_ts`/`observed_ts` must include UTC.
