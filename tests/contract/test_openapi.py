from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from openapi_spec_validator import OpenAPIV31SpecValidator

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "contracts" / "openapi.yaml"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


@pytest.fixture(scope="module")
def spec() -> dict:
    return yaml.safe_load(SPEC_PATH.read_text())


def test_openapi_document_is_valid(spec):
    OpenAPIV31SpecValidator(spec, base_uri=SPEC_PATH.as_uri()).validate()


def _flatten_routes(routes):
    for route in routes:
        inner = getattr(route, "original_router", None)
        if inner is not None:
            yield from _flatten_routes(inner.routes)
        else:
            yield route


def test_spec_documents_every_route_the_app_exposes(spec, app):
    documented = {
        (path, method)
        for path, item in spec["paths"].items()
        for method in item
        if method in HTTP_METHODS
    }
    actual = {
        (route.path, method.lower())
        for route in _flatten_routes(app.routes)
        if getattr(route, "methods", None)
        for method in route.methods
        if method.lower() in HTTP_METHODS
    }
    assert actual == documented


def test_spec_has_exactly_six_operations(spec):
    operations = [
        (path, method)
        for path, item in spec["paths"].items()
        for method in item
        if method in HTTP_METHODS
    ]
    assert len(operations) == 6
