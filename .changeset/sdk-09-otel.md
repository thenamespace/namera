---
"@namera-ai/sdk": minor
---

`@namera-ai/sdk/otel`: `Otel.install()` (Promise API) and `Otel.layer` (Effect API) send Namera's spans
(`Namera.Grant.create`, `Namera.SmartAccount.detect`, …) to the app's global OpenTelemetry tracer provider, nested
under the active span. Spans carry `namera.chain.id`, `namera.account.type` and `namera.grant.id`, never keys,
signatures or URLs, and failures are recorded with URLs redacted, including those in a `ChainError`'s viem cause.
`@effect/opentelemetry` and `@opentelemetry/api` are optional peers; without `./otel`, no span code is bundled.
