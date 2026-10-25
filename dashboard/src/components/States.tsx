import type { ReactNode } from "react";

import { ApiError } from "../api/client";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="state empty">
      <p className="state-title">{title}</p>
      {hint ? <p className="state-hint">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const apiError = error instanceof ApiError ? error : undefined;
  const isAuth = apiError?.isAuthConfigProblem ?? false;

  return (
    <div className="state error" role="alert">
      <p className="state-title">
        {isAuth ? "Dashboard is not authenticated" : "Could not load data"}
      </p>
      <p className="state-hint">
        {isAuth
          ? "The API rejected the request. The dev server injects the admin credential from LAD_ADMIN_TOKEN (dashboard/.env.local or the repo-root .env). Restart `npm run dev` after setting it."
          : (error instanceof Error ? error.message : String(error))}
      </p>
      {apiError?.requestId ? (
        <p className="state-meta">
          request_id <code>{apiError.requestId}</code>
        </p>
      ) : null}
      {retry ? (
        <button type="button" className="btn" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
