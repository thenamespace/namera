# Client workspaces: SDK, CLI, and MCP

## `packages/sdk`

The SDK is the publishable typed client over the public API. It supports API-key and OAuth bearer authentication, maps protocol errors, and generates internal idempotency keys for retryable mutations.

Rules:

- Expose domain inputs, not transport headers or idempotency implementation details.
- Generate one key per logical execution/signature and reuse it within bounded automatic retries.
- Retry transient transport/provider outcomes only; never retry declared validation, authorization, policy, billing, or conflict errors blindly.
- Keep base URL configurable. Local defaults are development-only and must not become a published production default accidentally.
- Preserve abort signal and caller retry/timeouts.

## `apps/cli`

CLI uses Effect CLI and the SDK. Device OAuth obtains delegated authority; refresh rotation is serialized and persisted atomically. Commands support interactive prompts when `--params` is absent and schema-decoded JSON payload when present.

Global output modes:

- `pretty`: colorful, indented human-readable rendering (not JSON);
- `json`: one JSON value;
- `ndjson`: newline-delimited records for streams/lists;
- quiet: suppress non-result guidance/progress.

Reusable prompt services own addresses, values, dates, namespaces, chain IDs, and selectors. Command modules should orchestrate prompt/params → SDK call → renderer rather than reimplement validation or HTTP.

## MCP server in `apps/server`

MCP is a transport adapter over OAuth and application services, not a separate source of domain logic. The intentionally small tool set is:

- get/list wallet;
- get/list session key;
- execute/simulate transaction;
- get transaction status;
- sign/verify signature;
- get executions.

Tool schemas and descriptions must distinguish wallet IDs from session-key IDs, explain CAIP-2 chain IDs, state grant/policy requirements, and return stable typed error codes with policy ID/code when denied. Tool handlers map OAuth actor/grants into the same application operations used by API/CLI.

## Idempotency across clients

SDK is the lowest common generator for SDK/CLI integrations. MCP tool handlers generate/reuse a key around their own bounded retry boundary when not using SDK directly. End users are not asked to choose a key. Responses expose operation/submission IDs for status lookup rather than encouraging repeated new executions.

## Adding a public operation

1. Implement protocol/API/application/server first.
2. Add one SDK method with typed input/output/error mapping.
3. Add CLI interactive and `--params` paths using the same input schema.
4. Add an MCP tool only when agents genuinely need the capability; prefer a small orthogonal set.
5. Write descriptions/examples that prevent ID/namespace/chain confusion.
6. Add boundary tests for auth scopes, grants, policies, errors, output modes, and retries.

## Pending before production

- Publish SDK/CLI compatibility and release process.
- Replace any local-development API defaults before distribution.
- Add golden CLI output and MCP schema/description evaluations.
- Add secure OS credential storage for CLI refresh tokens if not already present.
