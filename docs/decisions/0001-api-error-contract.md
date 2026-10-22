# ADR-0001: API error contract

- Status: Proposed/Implemented
- Context: All six endpoints need uniform error handling; retryability must be part of the contract, not an implementation detail.
- Decision:
  1. One shared error shape for all endpoints (`api-errors.schema.json`).
  2. `code` is a closed enum of 8 values; new code = schema change.
  3. No `retryable` field — clients derive it from HTTP status (408/429/5xx retryable; other 4xx not), documented in OpenAPI.
  4. `details[].index` is the primary locator; `event_id` is optional because a rejected event's ID may be the broken field.
  5. `request_id` optional until the API always emits it.
  6. `additionalProperties: false` on errors (unlike events) — error shape is fully under our control.
- Consequences: + one error handler everywhere; + CI catches typo'd codes; − new error codes need a schema PR.
- Verified by: contract tests (fixtures per code).
