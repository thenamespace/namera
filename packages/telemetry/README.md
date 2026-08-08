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
- `src/metrics/magic-link.ts` — magic-link workflow metrics.

Metric files contain definitions only. Business services decide when metrics are
updated. Metric attributes must be bounded values; never use emails, tokens,
session IDs, user IDs, URLs, or arbitrary error messages.

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

const requestMagicLink = workflow.pipe(
  Effect.track(Metric.withConstantInput(magicLinkRequests, 1)),
);
```

Effect logs emitted inside spans are exported with their trace and span IDs.
