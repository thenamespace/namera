import * as Predicate from "effect/Predicate"

import type { NameraError } from "../NameraError.ts"

// The marker every error family carries, kept apart from `NameraError.ts`: that module decodes failures into the
// families, so the families can't import it back.

/**
 * The marker's key and value. Not internal: every error family's declaration uses it as a property key.
 */
export const TypeId = "~@namera-ai/sdk/NameraError" as const

/** @internal */
export const isNameraError = (u: unknown): u is NameraError => Predicate.hasProperty(u, TypeId)
