from __future__ import annotations

import uuid

from fastapi import FastAPI, Request

from lad.adapters.local.queue_fs import FileQueue
from lad.adapters.local.store_sqlite import SQLiteStore
from services.api.config import Settings
from services.api.errors import install_error_handlers
from services.api.routers import health, incidents, ingestion


def build_app(*, settings: Settings | None = None, store=None, queue=None) -> FastAPI:
    settings = settings or Settings.from_env()
    if store is None:
        store = SQLiteStore(settings.data_dir / "lad.sqlite3")
    if queue is None:
        queue = FileQueue(settings.data_dir / "queue")

    app = FastAPI(
        title="Log Anomaly Detector API",
        version=settings.version,
        # The canonical spec is contracts/openapi.yaml; do not expose a second one.
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings
    app.state.store = store
    app.state.queue = queue

    install_error_handlers(app)

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    app.include_router(health.router)
    app.include_router(ingestion.router)
    app.include_router(incidents.router)
    return app
