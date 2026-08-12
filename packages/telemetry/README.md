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
- `src/layer.ts` — environment-selected OTLP exporter layer.
- `src/metrics/common.ts` — transport-level metrics shared by server handlers.
- `src/metrics/email.ts` — durable email enqueue and delivery metrics.
- `src/metrics/magic-link.ts` — magic-link workflow metrics.
- `src/metrics/organization.ts` — organization and invitation workflow metrics.

Metric files contain definitions only. Business services decide when metrics are
updated. Metric attributes must be bounded values; never use emails, tokens,
session IDs, user IDs, URLs, or arbitrary error messages.

## Adding telemetry

- Wrap named Effect operations with spans through `Effect.fn`; add span
  attributes only when they are safe and useful.
- Log concise decisions and state transitions where they occur. Do not log the
  same payload at every layer or log secrets and unbounded objects.
- Add shared metrics under `src/metrics/<feature>.ts`, export them through the
  metrics barrel, and update them in the application or transport layer that
  owns the event.
- Prefer counters, timers, and preregistered frequency values. Labels and
  frequency words must have bounded cardinality.
- Keep exporter URLs, tokens, dataset selection, and environment switching in
  `TelemetryLive`; feature packages must remain vendor-neutral.

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
