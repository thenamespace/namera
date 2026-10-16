# Observability

Operational telemetry, audit history, and product analytics have separate purposes.
Telemetry diagnoses execution; audit preserves committed changes; analytics
measures product use. None substitutes for another.

## Traces, logs and metrics

`@namera-ai/telemetry` owns OTLP destinations and shared bounded metric definitions.
Effect workflow spans and logs are emitted by the layer that owns the decision.
Repository operations are the normal database span boundary; individual SQL child
spans are suppressed.

HTTP spans use normalized route templates rather than raw paths containing IDs.
Routine session probes, reference, callback and OTLP routes have explicit tracing
exclusions. Logs use concise transition names and safe classifications, not signed
payloads, credentials or arbitrary provider responses. Metric dimensions are
bounded values, never user IDs, emails, URLs or exception messages.

The session-key worker exposes separate `session_key` and `signing_key_deactivation`
poll/last-success labels. Deactivation backlog and oldest age include jobs requiring
operator attention. Terminal cleanup failures log a sanitized error code; typed
organization audit events record requested, completed and failed deactivation.

Development exports to local Grafana LGTM. Production exports traces, logs and
metrics to separate Axiom datasets. Server traces batch every ten seconds, logs
every second, and metrics every sixty seconds. Browser traces batch every second.
Browser exporters post to server `/t/traces/v1`, `/t/logs/v1`, and `/t/metrics/v1`;
the proxy adds upstream credentials. It enforces content type, a 2 MiB body limit,
a ten-second timeout and a dedicated IP rate limit.

## Product analytics

Browser PostHog runs only for production builds on allowed production hosts and
respects Do Not Track and Global Privacy Control. Generic autocapture and session
recording are disabled. Typed event filtering excludes credentials, request/form
content, query strings and exception messages. Public heatmaps, web vitals and
survey scheduling are handled separately by the browser adapter.

Server collection requires production and `POSTHOG_PROJECT_TOKEN`. Request outcome
events are best-effort observations, not unique business changes. Committed
milestones use `jobs.analytics_jobs` in the business transaction, then a worker
delivers stable event IDs/timestamps with retry. The collection context defaults
to disabled; adapters do not infer identity from arbitrary request payloads.

Source maps use a build-time secret. The browser project key is public; the
source-map API key and Axiom credentials must never have a `VITE_` prefix or enter
browser bundles.

## Source

- [Export configuration](../../packages/telemetry/src/)
- [Analytics adapters](../../packages/telemetry/src/analytics/)
- [Server telemetry](../../apps/server/src/middlewares/telemetry.ts)
- [Audit persistence](../data/audit.md)
