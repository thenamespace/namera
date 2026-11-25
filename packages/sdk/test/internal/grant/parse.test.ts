import { assert, describe, it } from "@effect/vitest"
import { Grant } from "@namera-ai/sdk"
import * as core from "@namera-ai/sdk/internal/core/grant/grant"
import { parse } from "@namera-ai/sdk/internal/grant/parse"
import * as Arbitrary from "effect/Arbitrary"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"

import { account, grantOf, sessions } from "../../grant.test-utils.ts"
import { parse as schemaParse } from "./schemaParse.test-utils.ts"

// `Grant.parse` checks untrusted input by hand. These tests mutate valid grants field by field and check that it
// accepts and refuses exactly what the Effect Schema decoder it replaced did, and never throws.

const grants: ReadonlyArray<unknown> = sessions.map((session, index) => {
  const grant = core.fromJson(Grant.serialize(grantOf(session))) as { readonly accountType: object }
  // The optional deployment, on one of them.
  return index === 0
    ? grant
    : { ...grant, accountType: { ...grant.accountType, deployment: { factory: account, factoryData: "0x1234" } } }
})

const hostile: ReadonlyArray<unknown> = [
  undefined,
  null,
  0,
  1,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  "",
  "x",
  "0x",
  "0x12",
  "never",
  true,
  false,
  [],
  {},
  5n,
  `0x${"00".repeat(20)}`,
  `0x${"00".repeat(32)}`,
  "eip155:0",
  "eip155:1",
  ["x"],
  [1]
]

type Path = ReadonlyArray<string>

const pathsOf = (value: unknown, path: Path = []): Array<Path> =>
  typeof value === "object" && value !== null
    ? [path, ...Object.entries(value).flatMap(([key, inner]) => pathsOf(inner, [...path, key]))]
    : [path]

/** Deletes the field or entry at `path`, sets it to `value`, or adds an `extra` field beside it. */
interface Mutation {
  readonly kind: "delete" | "set" | "extra"
  readonly path: Path
  readonly value?: unknown
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** `value` with one mutation applied; a path that a previous mutation removed leaves it unchanged. */
const mutate = (value: unknown, mutation: Mutation): unknown => {
  if (mutation.path.length === 0) return mutation.kind === "set" ? mutation.value : value
  const copy = structuredClone(value)
  let parent: unknown = copy
  for (const key of mutation.path.slice(0, -1)) parent = isObject(parent) ? parent[key] : undefined
  if (!isObject(parent)) return copy

  const last = mutation.path.at(-1)!
  if (mutation.kind === "extra") parent["extra"] = 1
  else if (mutation.kind === "set") parent[last] = mutation.value
  else if (Array.isArray(parent)) parent.splice(Number(last), 1)
  else delete parent[last]
  return copy
}

/** What a parser made of `input`: the accepted grant, or the refusal's reason; a throw fails the test. */
const verdict = (parser: typeof parse, input: unknown) => {
  const result = parser(input)
  return Result.isSuccess(result) ? { accepted: result.success } : { refused: result.failure.reason._tag }
}

const sameVerdict = (input: unknown) => {
  const hand = verdict(parse, input)
  assert.deepStrictEqual(hand, verdict(schemaParse, input))
  return hand
}

describe("Grant.parse", () => {
  it("accepts and refuses what the Schema decoder did, for every single-field mutation", () => {
    let accepted = 0
    for (const grant of grants) {
      for (const path of pathsOf(grant)) {
        const mutations: Array<Mutation> = [
          { kind: "delete", path },
          { kind: "extra", path },
          ...hostile.map((value) => ({ kind: "set" as const, path, value }))
        ]
        for (const mutation of mutations) if ("accepted" in sameVerdict(mutate(grant, mutation))) accepted++
      }
    }

    // Some mutations keep a grant valid (an equal value, a deleted optional field): both parsers accept those.
    assert.isAbove(accepted, 0)
  })

  const index = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 1_000_000 }))
  const mutations = Arbitrary.array(
    Arbitrary.schema(Schema.Struct({ kind: Schema.Literals(["delete", "set", "extra"]), path: index, value: index })),
    { minLength: 1, maxLength: 4 }
  )

  it.prop(
    "accepts and refuses what the Schema decoder did, for stacked mutations",
    { grant: index, mutations },
    ({ grant: which, mutations }) => {
      const grant = grants[which % grants.length]
      const paths = pathsOf(grant)
      const input = mutations.reduce<unknown>(
        (value, { kind, path, value: hostileValue }) =>
          mutate(value, { kind, path: paths[path % paths.length]!, value: hostile[hostileValue % hostile.length] }),
        grant
      )
      sameVerdict(input)
    },
    { arbitrary: { runs: 500 } }
  )
})
