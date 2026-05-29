# @namera-ai/telemetry

Shared observability package for Namera.

This package owns OpenTelemetry wiring, Effect telemetry integration, HTTP trace naming, trace skip rules, low-level span filtering, and shared metrics helpers. Application code should use Effect observability APIs (`Effect.fn`, `Effect.withSpan`, `Effect.annotateCurrentSpan`, `Metric.track`) while this package decides how those signals are exported.

## Package Structure

- `src/node` configures server-side OpenTelemetry for `namera-api`.
- `src/web` configures browser-side OpenTelemetry for `namera-dashboard`.
- `src/http-names.ts` contains shared HTTP operation naming and skip rules.
- `src/span-filter.ts` filters noisy low-level spans before export.
- `src/metrics` contains shared Effect metrics definitions.

Public exports:

```ts
import { OtelNode } from "@namera-ai/telemetry/node";
import { OtelWeb } from "@namera-ai/telemetry/web";
import { shouldSkipHttpTracing } from "@namera-ai/telemetry/http";
import { UserMetrics } from "@namera-ai/telemetry/metrics";
```

## Service Names

Use one service name per deployable runtime:

```text
namera-dashboard
namera-api
```

Do not create new service names for individual features, routes, or modules. Those belong in span names and attributes.

## Trace Shape

A good trace should read like product behavior:

```text
namera-dashboard auth.currentUser
  namera-dashboard auth.currentUser
    namera-api auth.currentUser
      namera-api auth.actor.resolve
```

For a mutation:

```text
namera-dashboard organization.create
  namera-dashboard organization.create
    namera-api organization.create
      namera-api auth.actor.resolve
      namera-api createOrganization
```

Avoid traces that read like infrastructure noise:

```text
http.client POST
  http.server POST
    sql.transaction
      sql.execute
      sql.execute
```

Low-level database spans are filtered by default. Temporarily enable them for debugging:

```sh
OTEL_LOW_LEVEL_DB_SPANS=true
```

## Span Naming

Use dot notation for frontend and backend business operations:

```text
auth.currentUser
auth.listSessions
auth.logout
auth.magicLink.signIn
auth.magicLink.verify
auth.user.update

organization.create
organization.list
organization.setActive
organization.get
organization.update

userPreferences.get
userPreferences.update
```

Names should be:

- stable across deploys
- low-cardinality
- product/domain oriented
- not tied to raw HTTP methods, IDs, SQL, or implementation details

Do not use names like:

```text
handlePost
doThing
fetchData
sql.execute
GET /api/v1/auth/me?userId=...
```

## Effect Convention

Use `Effect.fn("domain.operation")` for meaningful business logic.

```ts
export const createOrganization = Effect.fn("organization.create")(function* (
  input: CreateOrganizationRequest,
) {
  // business logic
});
```

Prefer `Effect.fn` over raw `Effect.gen` for reusable business operations. Use raw `Effect.gen` for inline code inside an already named operation.

Use `Effect.withSpan` only when an inner step is useful on its own and is not already implemented as a named `Effect.fn`.

```ts
const verifyMagicLink = Effect.fn("auth.magicLink.verify")(function* (token) {
  const verification = yield* findVerification(token);

  return yield* createSession(verification);
});
```

If `findVerification` and `createSession` are already `Effect.fn("...")`, they already create spans. Wrapping them in `Effect.withSpan` creates redundant nesting.

Do not span every helper, mapper, parser, or query wrapper.

## Frontend Action Spans

Dashboard actions should use the same dot notation as backend operations:

```ts
Effect.fn("organization.setActive")(function* () {
  yield* annotateDashboardRoute();
  yield* Effect.annotateCurrentSpan("organization.id", id);
  // API call
});
```

Use `annotateDashboardRoute` from `apps/dashboard/src/actions/telemetry.ts` so frontend spans include:

```text
app.route
```

`app.route` should represent the dashboard page where the action happened. Do not put route IDs or user input into the span name.

## Backend Spans

Backend route handlers should use domain operation names:

```ts
const updateOrganizationHandler = Effect.fn("organization.update")(function* ({
  payload,
}) {
  const actor = yield* CurrentActor;
  // business logic
});
```

Authentication resolution uses:

```text
auth.actor.resolve
```

It annotates protected backend traces with:

```text
userId
organization.id
organization.role
```

Backend is the authoritative source for user and organization identity. Frontend identity annotations are useful for debugging but should not be treated as audit truth.

## HTTP Span Naming

HTTP instrumentation is configured in this package. It normalizes paths and sets:

```text
namera.operation
http.route
```

Path normalization removes the API version prefix:

```text
/api/v1/auth/me -> /auth/me
/api/v1/rpc/1   -> /rpc/:chainId
```

Most route names are inferred programmatically:

```text
POST /organization/create -> organization.create
GET /organization/list    -> organization.list
POST /auth/magic-link/sign-in -> auth.magicLink.signIn
```

Use explicit overrides only when inference produces a weaker name:

```ts
const operationOverrides = new Map<string, string>([
  ["GET /auth/me", "auth.currentUser"],
  ["DELETE /auth/sessions/me", "auth.logout"],
]);
```

## Trace Skip Rules

Use `shouldSkipHttpTracing` everywhere trace exclusion decisions are needed. Do not duplicate skip rules in server middleware or instrumentation.

Current defaults skip:

```text
HEAD *
OPTIONS *
/health
/telemetry/*
/rpc/*
static assets: .js, .css, .map, .png, .svg, .ico, .woff, .woff2, ...
```

Reasons:

- `HEAD` and `OPTIONS` are mostly probes and CORS preflight noise.
- `/health` is high-volume uptime noise.
- `/telemetry/*` avoids tracing telemetry export calls.
- `/rpc/*` is proxy traffic and should be observed with metrics or temporary debugging traces.
- static assets are browser infrastructure noise.

Do not skip normal product routes:

```text
/auth/*
/organization/*
/user-preferences/*
```

## Attributes

Good attributes:

```ts
yield *
  Effect.annotateCurrentSpan({
    "app.route": "/dashboard/settings/workspace",
    "auth.method": "magic_link",
    userId: user.id,
    "organization.id": organization.id,
    "organization.role": role,
  });
```

Avoid:

```text
user.email
user.name
session.token
request.body
raw SQL
full URLs with query strings
unbounded user input
```

Attributes should be useful for filtering and debugging without leaking secrets or creating uncontrolled cardinality.

## Metrics

Use Effect metrics for aggregate behavior, not trace detail.

Use counters for events:

```ts
yield * Metric.counter("auth.magic_link.sent").pipe(Metric.track(1));
```

Use histograms for durations and sizes:

```ts
yield *
  Effect.timed(operation).pipe(
    Effect.tap(([duration]) =>
      Metric.histogram("auth.magic_link.verify.duration").pipe(
        Metric.track(Duration.toMillis(duration)),
      ),
    ),
  );
```

Use gauges for current state:

```text
active_sessions
queue_depth
open_connections
```

Traces answer "what happened in this request?" Metrics answer "how often, how slow, how broken?"

## When Adding A New Feature

Checklist:

1. Add a named frontend action span if the dashboard triggers it.
2. Add a named backend operation span around the route handler or workflow.
3. Keep the span name in dot notation.
4. Add `annotateDashboardRoute` on frontend actions.
5. Add backend user/org annotations only from trusted backend context.
6. Avoid raw user input, raw SQL, tokens, and request bodies in attributes.
7. Do not add manual spans around every query.
8. Update `operationOverrides` only when inferred HTTP naming is not good enough.
9. Reuse `shouldSkipHttpTracing` for any new tracing middleware or instrumentation.

## Local And Production Export

Server-side OTEL config uses:

```text
OTEL_BASE_URL
OTEL_DATASET
OTEL_METRICS_DATASET
OTEL_API_TOKEN
OTEL_LOW_LEVEL_DB_SPANS
```

Browser-side OTEL config uses:

```text
VITE_OTEL_BASE_URL
```

The browser should send telemetry to the backend proxy, not directly to Axiom with a secret token. Metrics ingestion must use protobuf content type; JSON metrics ingestion is not supported by Axiom.
