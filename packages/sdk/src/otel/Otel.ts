/**
 * The OpenTelemetry bridge: Namera's spans (`Namera.Grant.create`, `Namera.SmartAccount.detect`, …) on the app's
 * OpenTelemetry tracer, nested under its active span.
 *
 * **Details**
 *
 * Spans carry `namera.chain.id`, `namera.account.type` and `namera.grant.id` where they apply, never keys,
 * signatures or endpoint URLs. Failures are recorded with URLs redacted from their messages and stacks, including
 * the messages of the viem errors a `ChainError` keeps as its cause.
 *
 * Needs `@effect/opentelemetry` and `@opentelemetry/api` (optional peers) and the app's own tracer provider, registered
 * globally (`trace.setGlobalTracerProvider`, or the OpenTelemetry Node SDK).
 *
 * @stability unstable
 * @since 2.0.0
 */
import * as OtelTracer from "@effect/opentelemetry/OtelTracer"
import type * as Otel from "@opentelemetry/api"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import { install as installLayer } from "../internal/promise.ts"
import { redactUrls } from "../internal/redact.ts"
import { enable } from "../internal/span.ts"
import { version } from "../internal/version.ts"

const redactException = (exception: Otel.Exception): Otel.Exception => {
  if (typeof exception === "string") return redactUrls(exception)
  if (exception instanceof Error) {
    const redacted = new Error(redactUrls(exception.message))
    redacted.name = exception.name
    if (exception.stack !== undefined) redacted.stack = redactUrls(exception.stack)
    return redacted
  }
  return {
    ...exception,
    ...(exception.message === undefined ? {} : { message: redactUrls(exception.message) }),
    ...(exception.stack === undefined ? {} : { stack: redactUrls(exception.stack) })
  }
}

// Effect records a failure with its whole cause chain in the stack, so the viem error a `ChainError` keeps (whose
// message has the request URL, API key included) would reach the exporter. Every span this tracer starts redacts URLs
// from what it records about a failure.
const redacting = (tracer: Otel.Tracer): Otel.Tracer => ({
  startSpan: (name, options, context) => {
    const span = tracer.startSpan(name, options, context)
    const recordException = span.recordException.bind(span)
    const setStatus = span.setStatus.bind(span)
    span.recordException = (exception, time) => recordException(redactException(exception), time)
    span.setStatus = (status) =>
      setStatus(status.message === undefined ? status : { ...status, message: redactUrls(status.message) })
    return span
  },
  startActiveSpan: tracer.startActiveSpan.bind(tracer) as Otel.Tracer["startActiveSpan"]
})

/**
 * Layer that sends Namera's spans to the global OpenTelemetry tracer provider, as the `@namera-ai/sdk` tracer.
 *
 * **When to use**
 *
 * Use with the Effect API: provide it to a program, and its Namera spans nest under the program's spans or, at the
 * top, under the active OpenTelemetry span. A program that already provides an OpenTelemetry tracer (the
 * `@effect/opentelemetry` Node SDK) needs nothing: Namera's spans go to the tracer in context.
 *
 * **Details**
 *
 * Built from `@effect/opentelemetry`'s `OtelTracer` (the global provider, as `OtelTracer.layerGlobal` reads it), with
 * failures redacted as the module describes.
 *
 * **Example** (Tracing an Effect program)
 *
 * ```ts
 * import { Grant } from "@namera-ai/sdk/effect"
 * import { Otel } from "@namera-ai/sdk/otel"
 * import { Effect } from "effect"
 *
 * const program = Grant.getStatus(client, { grant }).pipe(Effect.withSpan("checkout"), Effect.provide(Otel.layer))
 * ```
 *
 * @stability unstable
 * @category layers
 * @since 2.0.0
 */
export const layer: Layer.Layer<never> = OtelTracer.layerWithoutOtelTracer.pipe(
  Layer.provide(
    Layer.effect(
      OtelTracer.OtelTracer,
      Effect.map(
        Effect.service(OtelTracer.OtelTracerProvider),
        (provider) => redacting(provider.getTracer("@namera-ai/sdk", version))
      )
    )
  ),
  Layer.provide(OtelTracer.layerGlobalProvider),
  Layer.merge(Layer.effectDiscard(Effect.sync(enable)))
)

/**
 * Sends the Promise API's spans to the global OpenTelemetry tracer provider, and returns a function that stops it.
 *
 * **When to use**
 *
 * Use when an app on the Promise API has OpenTelemetry set up: call it once at startup, and each Namera call then
 * nests its span under the span active where it was called.
 *
 * **Details**
 *
 * Installs `Otel.layer` for every later Promise call. The Effect API is unaffected: Effect programs provide
 * `Otel.layer` or their own tracer, and the tracer in a program's context always wins.
 *
 * **Example** (Tracing the Promise API)
 *
 * ```ts
 * import { Grant } from "@namera-ai/sdk"
 * import { Otel } from "@namera-ai/sdk/otel"
 * import { trace } from "@opentelemetry/api"
 *
 * Otel.install()
 *
 * await trace.getTracer("app").startActiveSpan("checkout", async (span) => {
 *   await Grant.getStatus(client, { grant }) // a `Namera.Grant.getStatus` span under "checkout"
 *   span.end()
 * })
 * ```
 *
 * @stability unstable
 * @category tracing
 * @since 2.0.0
 */
export const install = (): () => void => installLayer(layer)
