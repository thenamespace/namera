# @namera-ai/telemetry

OTLP export layers, bounded metric definitions and product analytics adapters.
Application code emits Effect spans/logs and updates shared metrics; this private
package owns destinations and provider integration.

## Entry points

| Export                 | Responsibility                                                          |
| ---------------------- | ----------------------------------------------------------------------- |
| Root                   | OTLP layers, route normalization, metric definitions.                   |
| `analytics/browser`    | Production browser initialization, typed capture and privacy filtering. |
| `analytics/server`     | Server capture and acknowledged milestone delivery.                     |
| `analytics/collection` | Request/worker collection eligibility.                                  |
| `analytics/contract`   | Analytics event contract.                                               |

Browser analytics is separate from the Node root export. Application workflows
own milestone persistence; this package does not query the database.

## Configuration

| Variable                                                              | Purpose                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV`                                                            | Selects development LGTM or production Axiom.               |
| `TELEMETRY_SERVICE_VERSION`                                           | Release identity; defaults to `development`.                |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                                         | Development collector; defaults to `http://localhost:4318`. |
| `AXIOM_API_TOKEN`                                                     | Required production ingestion credential.                   |
| `AXIOM_OTLP_BASE_URL`                                                 | Optional Axiom endpoint override.                           |
| `AXIOM_TRACES_DATASET`, `AXIOM_LOGS_DATASET`, `AXIOM_METRICS_DATASET` | Required production destinations.                           |
| `POSTHOG_PROJECT_TOKEN`                                               | Enables production server product analytics.                |
| `VITE_POSTHOG_KEY`                                                    | Public browser project token.                               |

Browser OTLP uses server proxy URLs, never Axiom credentials. Private source-map
uploads use build-time `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_API_KEY`; the API
key must not be exposed as a browser variable.

Metrics use bounded attributes. Keep credentials, arbitrary payloads and identity
out of operational labels. Product analytics has its own typed allowlist.

```sh
pnpm --filter @namera-ai/telemetry test
pnpm --filter @namera-ai/telemetry typecheck
pnpm --filter @namera-ai/telemetry build
```

See [observability](../../architecture/runtime/observability.md) for signal and
delivery boundaries.
