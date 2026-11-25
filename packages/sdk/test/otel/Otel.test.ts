import { afterAll, afterEach, assert, describe, it } from "@effect/vitest"
import { Grant, SmartAccount } from "@namera-ai/sdk"
import * as EffectApi from "@namera-ai/sdk/effect"
import { Otel } from "@namera-ai/sdk/otel"
import { context, trace } from "@opentelemetry/api"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import { InMemorySpanExporter, type ReadableSpan, SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace"
import { Effect } from "effect"
import { createPublicClient, http, zeroAddress } from "viem"
import { mainnet } from "viem/chains"

import { grantOf, sessions } from "../grant.test-utils.ts"

// The app's OpenTelemetry setup: a global provider exporting to memory, and async context so `startActiveSpan`
// spans stay active across awaits.
const exporter = new InMemorySpanExporter()
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
trace.setGlobalTracerProvider(new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] }))
const app = trace.getTracer("app")

// A grant for chains 8453 and 10, checked on mainnet: `Grant.verify` refuses it before any request.
const grant = grantOf(sessions[0]!)
const client = createPublicClient({ chain: mainnet, transport: http("http://127.0.0.1:1", { retryCount: 0 }) })
const apiKey = "sk_live_0123456789abcdefghij"
const keyedClient = createPublicClient({
  chain: mainnet,
  transport: http(`http://127.0.0.1:1/v2/${apiKey}?apikey=${apiKey}`, { retryCount: 0 })
})

const spanNamed = (name: string): ReadableSpan => {
  const span = exporter.getFinishedSpans().find((span) => span.name === name)
  assert.isDefined(span, `no ${name} span among ${exporter.getFinishedSpans().map((span) => span.name).join(", ")}`)
  return span!
}

const isChildOf = (child: ReadableSpan, parent: ReadableSpan) =>
  child.parentSpanContext?.spanId === parent.spanContext().spanId
  && child.spanContext().traceId === parent.spanContext().traceId

describe("Otel", { concurrent: false }, () => {
  afterEach(() => exporter.reset())
  afterAll(() => {
    trace.disable()
    context.disable()
  })

  describe("Otel.install", () => {
    it("nests the Promise API's spans under the app's active span, with the chain, account type and grant", async () => {
      const uninstall = Otel.install()
      try {
        await app.startActiveSpan("checkout", async (span) => {
          await Grant.verify(client, grant).catch(() => undefined)
          span.end()
        })
      } finally {
        uninstall()
      }

      const verify = spanNamed("Namera.Grant.verify")
      assert.isTrue(isChildOf(verify, spanNamed("checkout")))
      assert.deepStrictEqual(verify.attributes, {
        "namera.chain.id": 1,
        "namera.account.type": "kernel",
        "namera.grant.id": grant.id
      })
      assert.strictEqual(verify.instrumentationScope.name, "@namera-ai/sdk")
    })

    it("records failures without the endpoint's credentials", async () => {
      const uninstall = Otel.install()
      try {
        await SmartAccount.detect(keyedClient, { address: zeroAddress }).catch(() => undefined)
      } finally {
        uninstall()
      }

      const detect = spanNamed("Namera.SmartAccount.detect")
      assert.isAbove(detect.events.length, 0)
      const recorded = JSON.stringify({ events: detect.events, status: detect.status, attributes: detect.attributes })
      assert.include(recorded, "127.0.0.1")
      assert.notInclude(recorded, apiKey)
    })

    it("stops exporting once uninstalled", async () => {
      Otel.install()()
      await Grant.verify(client, grant).catch(() => undefined)

      assert.deepStrictEqual(exporter.getFinishedSpans(), [])
    })
  })

  describe("Otel.layer", () => {
    it.effect("nests the Effect API's spans under the program's span", () =>
      Effect.gen(function*() {
        yield* EffectApi.Grant.verify(client, grant).pipe(
          Effect.ignore,
          Effect.withSpan("checkout"),
          Effect.provide(Otel.layer)
        )

        assert.isTrue(isChildOf(spanNamed("Namera.Grant.verify"), spanNamed("checkout")))
      }))

    it("nests the Effect API's top spans under the app's active OpenTelemetry span", async () => {
      await app.startActiveSpan("request", async (span) => {
        await Effect.runPromise(EffectApi.Grant.verify(client, grant).pipe(Effect.ignore, Effect.provide(Otel.layer)))
        span.end()
      })

      assert.isTrue(isChildOf(spanNamed("Namera.Grant.verify"), spanNamed("request")))
    })
  })
})
