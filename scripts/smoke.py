"""End-to-end local smoke test.

Starts the real FastAPI app on a free port against a throwaway data directory,
seeds demo incidents, then exercises the HTTP contract:

  health -> ingest -> duplicate idempotency -> auth boundary -> list -> lifecycle

Usage:
    python -m scripts.smoke
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECTOR_TOKEN = "smoke-collector-token"
ADMIN_TOKEN = "smoke-admin-token"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _request(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict | None = None,
) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read() or b"null")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"null")


def _wait_for_health(base_url: str, process: subprocess.Popen, timeout: float = 20) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"server exited early with code {process.returncode}")
        try:
            status, body = _request("GET", f"{base_url}/api/v1/health")
            if status == 200:
                return body
        except (urllib.error.URLError, ConnectionError):
            pass
        time.sleep(0.2)
    raise RuntimeError(f"server did not become healthy within {timeout}s")


def run() -> None:
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"

    with tempfile.TemporaryDirectory(prefix="lad-smoke-") as data_dir:
        subprocess.run(
            [sys.executable, "-m", "scripts.seed_incidents", "--data-dir", data_dir],
            cwd=ROOT,
            check=True,
            stdout=subprocess.DEVNULL,
        )

        env = os.environ.copy()
        env.update(
            {
                "LAD_COLLECTOR_TOKEN": COLLECTOR_TOKEN,
                "LAD_ADMIN_TOKEN": ADMIN_TOKEN,
                "LAD_DATA_DIR": data_dir,
            }
        )
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "services.api.main:build_app",
                "--factory",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--log-level",
                "warning",
            ],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            health = _wait_for_health(base_url, process)
            assert health["status"] == "ok", health
            print(f"health           ok (version {health['version']})")

            event = json.loads(
                (ROOT / "contracts" / "fixtures" / "valid" / "http_5xx.json").read_text()
            )
            status, receipt = _request(
                "POST",
                f"{base_url}/api/v1/events/batch",
                token=COLLECTOR_TOKEN,
                payload={"events": [event]},
            )
            assert status == 202, (status, receipt)
            assert receipt["accepted"] == 1 and receipt["rejected"] == 0, receipt
            print("ingest           202 accepted=1 rejected=0")

            status, duplicate = _request(
                "POST",
                f"{base_url}/api/v1/events/batch",
                token=COLLECTOR_TOKEN,
                payload={"events": [event]},
            )
            assert status == 202, (status, duplicate)
            assert duplicate["results"][0]["detail"] == "already accepted", duplicate
            queued = list((Path(data_dir) / "queue").glob("*.json"))
            assert len(queued) == 1, queued
            print("duplicate        202 detail='already accepted', queue files=1")

            status, error = _request("GET", f"{base_url}/api/v1/incidents")
            assert status == 401 and error["error"]["code"] == "unauthorized", (status, error)
            print("auth             401 unauthorized without token")

            status, listing = _request(
                "GET", f"{base_url}/api/v1/incidents", token=ADMIN_TOKEN
            )
            assert status == 200, (status, listing)
            assert len(listing["items"]) == 3, listing
            print("incidents        200 items=3")

            open_incident = next(
                item for item in listing["items"] if item["status"] == "open"
            )
            incident_id = open_incident["incident_id"]
            status, acknowledged = _request(
                "POST",
                f"{base_url}/api/v1/incidents/{incident_id}/acknowledge",
                token=ADMIN_TOKEN,
            )
            assert status == 200 and acknowledged["status"] == "acknowledged", acknowledged
            assert len(acknowledged["audit"]) == 1, acknowledged["audit"]
            print(f"lifecycle        {incident_id}: open -> acknowledged (audit=1)")

            status, again = _request(
                "POST",
                f"{base_url}/api/v1/incidents/{incident_id}/acknowledge",
                token=ADMIN_TOKEN,
            )
            assert status == 200 and len(again["audit"]) == 1, again
            print("idempotency      acknowledge again -> no new audit entry")

            print("\nsmoke OK")
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()


def main() -> int:
    try:
        run()
    except AssertionError as exc:
        print(f"smoke FAILED: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"smoke FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
