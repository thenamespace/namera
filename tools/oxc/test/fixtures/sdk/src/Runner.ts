import * as Effect from "effect/Effect"
import { runSync } from "effect/Effect"

export const value: number = Effect.runSync(Effect.succeed(1)) + runSync(Effect.succeed(2))
