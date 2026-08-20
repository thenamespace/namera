# Delivery workspaces: emails, telemetry, UI, and dashboard

## `packages/emails`

Emails owns typed encrypted delivery jobs, runtime React Email templates, the worker state machine, and provider adapters. Domain workflows enqueue through `EmailJobs` inside their existing transaction; only the worker calls Resend. See [email delivery](../notifications/email-delivery.md).

Adding an email requires a protocol/template variable shape, closed job-payload union case, React Email template, adapter routing, application enqueue at the owning transaction, preview fixture, and delivery tests. Never put product authorization in a template or provider adapter.

## `packages/telemetry`

Telemetry owns shared metric definitions and OTLP exporter/resource layers. Read `TELEMETRY.md` before changes.

Rules:

- Metric attributes must be bounded enums/low-cardinality values.
- Traces/logs may correlate IDs when useful but never credentials, signed content, email addresses, provider secrets, or arbitrary request payloads.
- Audit events remain PostgreSQL product history; metrics are aggregate runtime behavior.
- Browser OTLP goes through the server proxy; vendor credentials never enter Vite bundles.
- Provider/export layers are selected at server composition, not application use cases.

## `packages/ui`

UI wraps Namespace UIKit and owns genuinely shared presentation primitives, hooks, icons, utilities, and styles. It imports protocol only for reusable domain displays. Route data fetching/mutations remain in dashboard.

Rules:

- Use semantic tokens and UIKit components/variants.
- Preserve focus, keyboard behavior, labels, errors, and live announcements.
- Avoid business-specific wrappers unless reused by unrelated routes.
- Keep generic table/filter/display helpers under the established common table boundary.
- Changes to primitive checkbox/tooltip/popover behavior require cross-dashboard visual/regression review.

## `apps/dashboard`

Dashboard is a Vite React/TanStack Router application. It uses Effect Atom for shared server state, router-owned registry loader prefetch, typed API atoms/hooks, React Hook Form with Effect Schema resolvers, and UIKit for controls.

### Feature structure

- Route files are declarative and small.
- Route-only components live in sibling `-components` directories.
- Shared unrelated-route components live in `src/components` under existing domain/common structure.
- Domain hooks expose mutation callbacks; components render shared feedback/toast messages.
- Tables reuse common filter/display/action primitives but keep domain column/row renderers local.

### Adding a dashboard feature

1. Confirm the API contract and server authorization exist.
2. Add atoms/hooks and loader prefetch using the router registry.
3. Add a route and route-local components.
4. Use protocol schema-driven forms; do not duplicate validation.
5. Add permission-aware loading/empty/error states and mutation feedback.
6. Test signed-in UI at localhost plus keyboard/focus/responsive behavior.

## `apps/email-templates`

This app previews package-owned runtime templates and generates email-safe PNG assets. It is not imported by the server at runtime and does not own delivery/provider behavior.

## Pending before production

- Add dashboard accessibility and critical-flow browser tests.
- Add visual regression coverage for shared table/popover/tooltip primitives.
- Verify browser telemetry proxy privacy and failure behavior.
