# Telemetry standard

Namera emits traces, structured logs, and metrics through Effect. The
`@namera-ai/telemetry` package owns exporters, route normalization, service
identity, and shared metric definitions. Feature packages remain independent of
LGTM, Axiom, and OTLP transport details.

## Traces

Trace workflow and dependency boundaries, not every helper.

- Keep one client span and one server span for an HTTP request.
- HTTP names use `http.client <METHOD> <route>` and
  `http.server <METHOD> <route>`. Routes must be stable templates such as
  `/wallets/:walletId`, never raw identifiers or query strings.
- Keep application operations, repository calls, external providers, and SQL
  transaction spans when they explain meaningful work. Repository operations
  are the default database boundary; low-level Drizzle and `sql.execute` spans
  are disabled inside them because they duplicate that boundary and overwhelm
  business traces. Enable query-level tracing only for a focused database
  investigation, not as the application default.
- Use `Effect.fnUntraced` for context lookup, decoding, field construction,
  cryptographic primitives, and other small helpers whose parent operation is
  already traced.
- Do not trace OTLP proxy handling. Otherwise exporting telemetry produces more
  telemetry and creates orphan roots.
- Routine current-session probes are untraced because an expected `401` is
  navigation state rather than an operational failure.

A representative mutation should remain readable without collapsing dozens of
microspans:

```text
http.client POST /wallets
└─ http.server POST /wallets
   ├─ server.authorization.authToken
   └─ application.wallet.create
      ├─ Billing enforcement
      ├─ wallet-keys.local.create
      ├─ evm.createAccount
      └─ sql.transaction
         ├─ database.walletRepository.insert
         ├─ audit
         └─ notifications
```

Span namespaces are lowercase and identify the owning boundary: `server.*`,
`application.*`, `database.*`, `emails.*`, `wallet-keys.*`, and `evm.*`.
Operation names may remain camel-cased for readability. Do not use the exported
service class name as the span prefix.

## Logs

Use one concise event name and structured annotations:

```ts
yield *
  Effect.logInfo("wallet.created").pipe(
    Effect.annotateLogs({
      namespace: "eip155",
      implementation: "kernel",
      protection_level: "software",
    }),
  );
```

Do not pass an object as a second log message; exporters encode that as another
message value rather than queryable fields. Keep attribute names stable and use
snake case. Shared and production layers must not log secrets, credentials,
arbitrary payloads, or unbounded failure text. Provider-owned development layers
may deliberately show local test values when their README documents it.

## Metrics

- Define metrics in `packages/telemetry/src/metrics/` and update them at the
  boundary that knows the result.
- Use counters for occurrences and outcomes, timers for latency, and gauges for
  current values.
- Outcome metrics use a bounded `result` attribute. Other labels use snake case.
- Safe labels include route templates, HTTP methods, status classes, provider,
  namespace, implementation, protection level, and closed result values.
- Never label metrics with user, organization, session, wallet, or request IDs;
  email/IP addresses; raw URLs; or arbitrary error messages.
- HTTP metrics exclude `/t/*` so an exporter request cannot create a metrics
  feedback loop.

## Browser and proxy

The dashboard exports only to server-owned `/t/traces/v1`, `/t/logs/v1`, and
`/t/metrics/v1`. It never receives LGTM or Axiom credentials. Browser exporters
flush every second to reduce loss when a successful operation immediately
navigates. The proxy validates content type and size, applies its own rate limit
and timeout, and runs with tracing disabled.

## Verification

After changing instrumentation:

1. Exercise one read and one mutation from the dashboard.
2. Confirm the mutation is a single cross-service trace with stable HTTP names.
3. Confirm no `/t/*`, `Telemetry.resolveExport`, or helper-only root traces exist.
   Confirm idle workers do not emit polling traces and repository spans are not
   expanded into repetitive `drizzle.operation` or `sql.execute` children.
4. Confirm logs contain one event message, structured fields, and trace/span IDs.
5. Confirm request count and duration metrics contain only method, route, and
   status-class labels.
6. Inspect metric labels for bounded cardinality before committing.
