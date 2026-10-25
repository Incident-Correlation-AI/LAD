import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchIncident, fetchIncidents } from "../api/client";

/**
 * The API wraps every failure in `{"error": {code, message, request_id}}`.
 * Reading the envelope's top level instead silently discarded all of that, so
 * these tests pin the contract shape rather than the implementation.
 */
function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const mockedFetch = vi.fn();

beforeEach(() => {
  mockedFetch.mockReset();
  vi.stubGlobal("fetch", mockedFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client error parsing", () => {
  it("reads message, code, request_id and details from the error envelope", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: "validation_failed",
          message: "Request validation failed",
          request_id: "req-422",
          details: [{ field: "query.limit", reason: "Input should be less than or equal to 100" }],
        },
      }),
    );

    const error = (await fetchIncidents({}).catch((caught) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Request validation failed");
    expect(error.code).toBe("validation_failed");
    expect(error.requestId).toBe("req-422");
    expect(error.details).toEqual([
      { field: "query.limit", reason: "Input should be less than or equal to 100" },
    ]);
  });

  it("surfaces the server's auth message and flags it as a config problem", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(401, {
        error: {
          code: "unauthorized",
          message: "Missing bearer credential",
          request_id: "req-401",
        },
      }),
    );

    const error = (await fetchIncident("inc_1").catch((caught) => caught)) as ApiError;

    expect(error.message).toBe("Missing bearer credential");
    expect(error.isAuthConfigProblem).toBe(true);
  });

  it("falls back to a status message but keeps the X-Request-ID header", async () => {
    mockedFetch.mockResolvedValue(
      new Response("<html>gateway went away</html>", {
        status: 502,
        headers: { "x-request-id": "proxy-req-9" },
      }),
    );

    const error = (await fetchIncidents({}).catch((caught) => caught)) as ApiError;

    expect(error.message).toBe("Request failed with status 502");
    expect(error.code).toBeUndefined();
    expect(error.requestId).toBe("proxy-req-9");
    expect(error.details).toEqual([]);
  });
});
