# Contract packages: protocol and API

## `packages/protocol`

Protocol is the shared language of every runtime. It contains Effect schemas and derived TypeScript types for primitives, branded identities, persisted models, public DTOs, namespace unions, audit/notification payloads, policy types, and expected tagged errors.

### Internal organization

- `src/model`: persistence/domain models and encoded forms.
- `src/dto`: public request/response projections; safe views must exclude sensitive fields.
- `src/evm`: EVM primitives, execution/signature context/results, policies, and chain IDs.
- `src/local`: client-only session authority and encrypted keystore contracts,
  exported separately as `@namera-ai/protocol/local`. These are not API DTOs.
- domain error modules: `Schema.TaggedError` expected failures.
- audit/notification model modules: closed versioned event unions.

### Rules

- Decode every untrusted HTTP, persistence JSONB, provider-normalized, and CLI `--params` value with Schema.
- Use discriminated unions for namespace/operation/provider variants.
- Brand only identities where mixing values would be a defect.
- Keep persistence-only sensitive fields out of public DTOs.
- Version stored/event payloads where future decoding must remain possible.
- Do not import database, application, API, Node runtime, or provider SDKs.

### Adding a model/DTO/error

1. Place it in the owning domain module; do not create a second generic root entry.
2. Model runtime/encoded differences explicitly (dates, bigint, redacted data).
3. Export only supported public contracts through domain/root barrels.
4. Add schema encode/decode tests and invalid boundary cases.
5. Update downstream repositories/application/API in dependency order.

## `packages/api`

API is the typed transport declaration built with Effect `HttpApi`. It declares path, method, params/query/payload, success, expected errors, middleware annotation, OpenAPI summary/description, and group prefix. It contains no handlers.

### Rules

- Import request/response/error schemas from protocol.
- Keep common transport error unions centralized.
- Apply typed authorization middleware to protected groups.
- Use response headers/status schemas for `no-store`, redirects, accepted responses, and protocol requirements.
- Keep OAuth protocol form endpoints distinct from authenticated JSON management endpoints.
- Never query repositories or construct application layers here.

### Adding an endpoint

1. Finalize protocol DTO/error schemas.
2. Add the endpoint to the existing owning group, preserving prefixes and names.
3. Annotate expected success status/headers and OpenAPI summary.
4. Add server handler and permission/actor enforcement.
5. Add SDK mapping only after the server boundary works.
6. Add server contract/authorization tests.

## Compatibility boundary

Protocol and API changes can break dashboard, SDK, CLI, and MCP simultaneously. Additive fields should have decoding/default semantics where older clients may omit them. Removing/renaming public values requires an explicit version/migration plan once production compatibility begins.
