import { NameraError, type SerializationError } from "@namera-ai/sdk"
import { NameraError as EffectNameraError } from "@namera-ai/sdk/effect"
import type { Effect } from "effect"
import { describe, expect, it } from "tstyche"

describe("NameraError.toJSON and fromJSON", () => {
  it("rebuild any Namera error; the Effect form fails with SerializationError", () => {
    expect(NameraError.fromJSON).type.toBe<(json: unknown) => NameraError.NameraError>()
    expect(EffectNameraError.fromJSON({})).type.toBe<
      Effect.Effect<NameraError.NameraError, SerializationError.SerializationError>
    >()
    expect<SerializationError.SerializationError>().type.toBeAssignableTo<NameraError.NameraError>()
  })

  it("write the family's tag", () => {
    expect<NameraError.Json["_tag"]>().type.toBe<NameraError.NameraError["_tag"]>()
  })
})
