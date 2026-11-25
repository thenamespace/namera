import { Session } from "@namera-ai/sdk"
import { Session as EffectSession } from "@namera-ai/sdk/effect"
import type { Effect } from "effect"
import { describe, expect, it } from "tstyche"

describe("Session.now", () => {
  it("returns plain seconds in the Promise API, with its type under the function's name", () => {
    expect(Session.now).type.toBe<() => number>()
    expect<Session.now.ReturnType>().type.toBe<number>()
  })

  it("returns an Effect that cannot fail in the Effect API", () => {
    expect(EffectSession.now()).type.toBe<Effect.Effect<number>>()
  })
})
