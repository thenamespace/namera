import * as Effect from "effect/Effect"

export const run = <A>(effect: Effect.Effect<A>): Promise<A> => Effect.runPromise(effect)
