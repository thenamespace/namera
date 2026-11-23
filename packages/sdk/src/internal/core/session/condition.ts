import * as Address from "ox/Address"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

// Conditions compiled to the comparisons `ArgPolicy` and `SignaturePolicy` apply to one 32-byte word
// (contracts/src/policies/lib/Conditions.sol), as unsigned integers.

/**
 * `Conditions.Condition`'s values.
 *
 * @internal
 */
export const Operator = { eq: 0, neq: 1, lt: 2, lte: 3, gt: 4, gte: 5, between: 6, oneOf: 7 } as const

/**
 * How a word is read: an unsigned integer of `bits`, an address, a boolean, `bytesN` (left-aligned), or the
 * keccak256 hash a dynamic EIP-712 field is encoded as.
 *
 * @internal
 */
export type Word =
  | { readonly type: "uint"; readonly bits: number }
  | { readonly type: "address" }
  | { readonly type: "bool" }
  | { readonly type: "bytes"; readonly size: number }
  | { readonly type: "hash"; readonly of: "string" | "bytes" }

/**
 * A condition as the contracts read it: an operator and its reference words.
 *
 * @internal
 */
export interface Comparison {
  readonly operator: (typeof Operator)[keyof typeof Operator]
  readonly refs: ReadonlyArray<Hex.Hex>
}

const bounds = ["lt", "lte", "gt", "gte"] as const

/** The word a value is compared as, or why it can't be one. */
const toWord = (word: Word, value: unknown): Hex.Hex | string => {
  switch (word.type) {
    case "uint":
      if (typeof value !== "bigint" || value < BigInt(0) || value >= BigInt(2) ** BigInt(word.bits)) {
        return `expected a bigint from 0 to 2^${word.bits} - 1`
      }
      return Hex.fromNumber(value, { size: 32 })
    case "address":
      if (typeof value !== "string" || !Address.validate(value)) return "expected an address"
      return Hex.padLeft(value.toLowerCase() as Hex.Hex, 32)
    case "bool":
      if (typeof value !== "boolean") return "expected a boolean"
      return Hex.fromNumber(value ? 1 : 0, { size: 32 })
    case "bytes":
      if (typeof value !== "string" || !Hex.validate(value) || Hex.size(value) !== word.size) {
        return `expected ${word.size} bytes of hex`
      }
      return Hex.padRight(value.toLowerCase() as Hex.Hex, 32)
    case "hash":
      if (word.of === "string") {
        return typeof value === "string" ? Hash.keccak256(Hex.fromString(value)) : "expected a string"
      }
      return typeof value === "string" && Hex.validate(value) ? Hash.keccak256(value) : "expected hex bytes"
  }
}

const isOrdered = (word: Word): boolean => word.type === "uint"

/**
 * Compiles a condition on a value of `word`: a value for equality, a non-empty list for one of, or one bound
 * (`lt`, `lte`, `gt`, `gte`, `between`) for an unsigned integer. A string says what is wrong with it.
 *
 * @internal
 */
export const compare = (word: Word, condition: unknown): Comparison | string => {
  if (Array.isArray(condition)) {
    if (condition.length === 0) return "a list of allowed values must not be empty"
    const refs: Array<Hex.Hex> = []
    for (const value of condition) {
      const ref = toWord(word, value)
      if (!Hex.validate(ref)) return ref
      if (!refs.includes(ref)) refs.push(ref)
    }
    return refs.length === 1 ? { operator: Operator.eq, refs } : { operator: Operator.oneOf, refs }
  }

  if (typeof condition === "object" && condition !== null) {
    const keys = Object.keys(condition)
    const key = keys[0]
    if (keys.length !== 1 || key === undefined || !(key === "between" || bounds.includes(key as never))) {
      return "expected one of lt, lte, gt, gte or between"
    }
    if (!isOrdered(word)) return "bounds compare unsigned integers only; use a value or a list"
    const bound = (condition as Record<string, unknown>)[key]
    if (key === "between") {
      if (!Array.isArray(bound) || bound.length !== 2) return "between takes [low, high]"
      const low = toWord(word, bound[0])
      const high = toWord(word, bound[1])
      if (!Hex.validate(low)) return low
      if (!Hex.validate(high)) return high
      if (BigInt(low) > BigInt(high)) return "between takes [low, high] with low <= high"
      return { operator: Operator.between, refs: [low, high] }
    }
    const ref = toWord(word, bound)
    if (!Hex.validate(ref)) return ref
    return { operator: Operator[key as (typeof bounds)[number]], refs: [ref] }
  }

  const ref = toWord(word, condition)
  return Hex.validate(ref) ? { operator: Operator.eq, refs: [ref] } : ref
}
