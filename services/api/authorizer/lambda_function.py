import hmac
import os


def lambda_handler(event, context):
    headers = event.get("headers") or {}
    raw = headers.get("authorization") or headers.get("Authorization") or ""
    parts = raw.split(" ", 1)
    token = parts[-1].strip() if parts[0].lower() == "bearer" and len(parts) > 1 else raw
    path = (event.get("requestContext", {}).get("http", {}) or {}).get("path", "")

    collector = os.environ.get("COLLECTOR_TOKEN", "")
    admin = os.environ.get("ADMIN_TOKEN", "")

    is_collector_route = path.startswith("/api/v1/events/batch")
    is_admin_route = path.startswith("/api/v1/incidents")

    verdict = "none"
    if is_collector_route and collector and token and hmac.compare_digest(token, collector):
        verdict = "collector"
    elif is_admin_route and admin and token and hmac.compare_digest(token, admin):
        verdict = "admin"
    print(f"authz path={path} verdict={verdict}")

    return {"isAuthorized": verdict != "none", "context": {}}
