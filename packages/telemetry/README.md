# @namera-ai/telemetry

OpenTelemetry export and shared metric definitions for Namera. It uses Effect's
OTLP tracing, logging, and metrics exporters with protobuf serialization.

- Development sends OTLP to the local Grafana LGTM collector.
- Production sends each signal directly to its dedicated Axiom dataset.
- Application code uses Effect tracing and logging directly and imports shared
  metric definitions from this package.

## Structure

- `src/config.ts` — common telemetry and production Axiom configuration.
- `src/data.ts` — code-owned service identity and exporter timing.
- `src/export.ts` — environment-selected OTLP destinations and provider headers.
- `src/http.ts` — bounded HTTP route templates and status-class helpers.
- `src/layer.ts` — reusable OTLP exporter layer and the server live layer.
- `src/metrics/auth.ts` — user-profile and session-lifecycle metrics.
- `src/metrics/api-key.ts` — API-key creation outcomes and duration.
- `src/metrics/common.ts` — transport-level metrics shared by server handlers.
- `src/metrics/email.ts` — durable email enqueue and delivery metrics.
- `src/metrics/magic-link.ts` — magic-link workflow metrics.
- `src/metrics/notification.ts` — occurrence, recipient, and preference metrics.
- `src/metrics/organization.ts` — organization and invitation workflow metrics.
- `src/metrics/session-key.ts` — session-key creation outcomes and duration.
- `src/metrics/signature.ts` — signature outcomes, duration, and policy decisions.
- `src/metrics/wallet.ts` — wallet creation outcomes and duration.

Metric files contain definitions only. Business services decide when metrics are
updated. Metric attributes must be bounded values; never use emails, tokens,
session IDs, user IDs, URLs, or arbitrary error messages.

## Adding telemetry

Read the root [`TELEMETRY.md`](../../TELEMETRY.md) before changing
instrumentation.

- Wrap workflow and dependency boundaries with spans through `Effect.fn`. Use
  `Effect.fnUntraced` for small helpers already explained by their parent span.
- Log concise decisions and state transitions where they occur. Do not log the
  same payload at every layer or log secrets and unbounded objects.
- Add shared metrics under `src/metrics/<feature>.ts`, export them through the
  metrics barrel, and update them in the application or transport layer that
  owns the event.
- Prefer counters, timers, and preregistered frequency values. Labels and
  frequency words must have bounded cardinality.
- Keep exporter URLs, tokens, dataset selection, and environment switching in
  this package; feature packages must remain vendor-neutral.

Browser code uses `makeTelemetryLayer` with the dashboard service identity and
the server-owned `/t/traces/v1`, `/t/logs/v1`, and `/t/metrics/v1` endpoints.
The browser never receives Axiom credentials or the local collector address.
The server resolves those upstream destinations with `resolveTelemetryExport`
and attaches provider authorization only while proxying.

The server emits one route-normalized span plus bounded request count and
duration metrics for each non-telemetry request. Browser exporters use a
one-second interval to reduce loss during navigation. OTLP proxy operations and
routine current-session probes are intentionally untraced.

## Environment

| Variable                      | Required                 | Purpose                         |
| ----------------------------- | ------------------------ | ------------------------------- |
| `NODE_ENV`                    | No; defaults development | Selects local LGTM or Axiom.    |
| `TELEMETRY_SERVICE_VERSION`   | No; defaults development | Exported service version.       |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No; defaults localhost   | Local LGTM OTLP/HTTP base URL.  |
| `AXIOM_API_TOKEN`             | Production               | Redacted Axiom ingestion token. |
| `AXIOM_OTLP_BASE_URL`         | No; defaults Axiom Cloud | Axiom or Axiom Edge base URL.   |
| `AXIOM_TRACES_DATASET`        | Production               | Dedicated traces dataset.       |
| `AXIOM_LOGS_DATASET`          | Production               | Dedicated logs dataset.         |
| `AXIOM_METRICS_DATASET`       | Production               | Dedicated metrics dataset.      |

## Usage

Provide the exporter layer at the server composition root:

```ts
import { TelemetryLive } from "@namera-ai/telemetry";

const MainLive = ServerLive.pipe(Layer.provide(TelemetryLive));
```

Track a shared metric inside an application workflow:

```ts
import { magicLinkRequests } from "@namera-ai/telemetry";
import { Effect, Metric } from "effect";

const requestMagicLink = Effect.gen(function* () {
  yield* Metric.update(magicLinkRequests, 1);
  // run the workflow
});
```

Effect logs emitted inside spans are exported with their trace and span IDs.
