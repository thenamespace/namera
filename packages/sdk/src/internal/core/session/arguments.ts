import * as AbiItem from "ox/AbiItem"
import type * as Hex from "ox/Hex"

import { compare, type Comparison, type Word } from "./condition.ts"

// Conditions on a function's arguments, resolved to the words `ArgPolicy` reads: `offset` bytes after the selector.
// Only static arguments have a fixed offset (ArgPolicy v1); a static tuple's fields are inline.

/**
 * One condition on one argument word.
 *
 * @internal
 */
export interface ArgumentRule {
  readonly argument: string
  readonly offset: number
  readonly word: Word
  readonly comparison: Comparison
}

/**
 * The resolved function: its selector and signature, the rules on its arguments, and the address and amount
 * arguments left unconditioned (for `Session.validate`'s warnings).
 *
 * @internal
 */
export interface ResolvedFunction {
  readonly selector: Hex.Hex
  readonly signature: string
  readonly rules: ReadonlyArray<ArgumentRule>
  readonly unrestricted: ReadonlyArray<{ readonly argument: string; readonly kind: "address" | "amount" }>
}

/**
 * Why arguments couldn't be resolved: a code for `Session.from`'s problem and what is wrong.
 *
 * @internal
 */
export interface ArgumentProblem {
  readonly code:
    | "UNKNOWN_FUNCTION"
    | "AMBIGUOUS_FUNCTION"
    | "UNKNOWN_ARGUMENT"
    | "DYNAMIC_ARG_CONDITION"
    | "UNSUPPORTED_CONDITION"
    | "INVALID_CONDITION"
  readonly message: string
}

interface Parameter {
  readonly name?: string | undefined
  readonly type: string
  readonly components?: ReadonlyArray<Parameter> | undefined
}

// Arguments named like amounts: an unconditioned one is worth a warning.
const AMOUNT_NAME = /amount|value|wad|shares|assets|qty|quantity/i

const fixedArray = /^(.+)\[(\d+)\]$/

/** The bytes a static parameter takes inline, or `undefined` for a dynamic one. */
const staticSize = (parameter: Parameter): number | undefined => {
  if (parameter.type === "string" || parameter.type === "bytes" || parameter.type.endsWith("[]")) return undefined
  const array = fixedArray.exec(parameter.type)
  if (array !== null) {
    const element = staticSize({ type: array[1]!, components: parameter.components })
    return element === undefined ? undefined : element * Number(array[2])
  }
  if (parameter.type === "tuple") {
    let size = 0
    for (const component of parameter.components ?? []) {
      const componentSize = staticSize(component)
      if (componentSize === undefined) return undefined
      size += componentSize
    }
    return size
  }
  return 32
}

/** How an atomic static type's word is read, or why a condition on it isn't supported. */
const wordOf = (type: string): Word | string => {
  if (type === "address") return { type: "address" }
  if (type === "bool") return { type: "bool" }
  const uint = /^uint(\d*)$/.exec(type)
  if (uint !== null) return { type: "uint", bits: uint[1] === "" ? 256 : Number(uint[1]) }
  const bytes = /^bytes(\d+)$/.exec(type)
  if (bytes !== null) return { type: "bytes", size: Number(bytes[1]) }
  if (/^int\d*$/.test(type)) return "signed integers can't be compared (ArgPolicy compares unsigned words)"
  return `conditions on ${type} are not supported`
}

const resolveParameters = (
  parameters: ReadonlyArray<Parameter>,
  conditions: { readonly [name: string]: unknown } | undefined,
  base: number,
  path: string,
  rules: Array<ArgumentRule>,
  unrestricted: Array<ResolvedFunction["unrestricted"][number]>
): ArgumentProblem | undefined => {
  const names = new Set(parameters.map((parameter) => parameter.name))
  for (const name of Object.keys(conditions ?? {})) {
    if (!names.has(name)) return { code: "UNKNOWN_ARGUMENT", message: `${path}${name} is not an argument` }
  }

  let offset = base
  for (const parameter of parameters) {
    const argument = `${path}${parameter.name ?? ""}`
    const size = staticSize(parameter)
    const condition = parameter.name === undefined ? undefined : conditions?.[parameter.name]

    if (condition === undefined) {
      // A struct left out may be anything: its address and amount fields are unrestricted.
      if (parameter.type === "tuple") {
        resolveParameters(parameter.components ?? [], undefined, offset, `${argument}.`, rules, unrestricted)
      } else if (parameter.type === "address") unrestricted.push({ argument, kind: "address" })
      else if (/^uint\d*$/.test(parameter.type) && AMOUNT_NAME.test(parameter.name ?? "")) {
        unrestricted.push({ argument, kind: "amount" })
      }
    } else if (size === undefined) {
      return {
        code: "DYNAMIC_ARG_CONDITION",
        message: `${argument} is ${parameter.type}, a dynamic argument; conditions apply to static arguments only`
      }
    } else if (parameter.type === "tuple") {
      if (typeof condition !== "object" || condition === null || Array.isArray(condition)) {
        return { code: "INVALID_CONDITION", message: `${argument} is a struct: give conditions on its fields` }
      }
      const nested = resolveParameters(
        parameter.components ?? [],
        condition as { readonly [name: string]: unknown },
        offset,
        `${argument}.`,
        rules,
        unrestricted
      )
      if (nested !== undefined) return nested
    } else if (fixedArray.test(parameter.type)) {
      return { code: "UNSUPPORTED_CONDITION", message: `conditions on arrays (${argument}) are not supported` }
    } else {
      const word = wordOf(parameter.type)
      if (typeof word === "string") return { code: "UNSUPPORTED_CONDITION", message: `${argument}: ${word}` }
      const comparison = compare(word, condition)
      if (typeof comparison === "string") return { code: "INVALID_CONDITION", message: `${argument}: ${comparison}` }
      rules.push({ argument, offset, word, comparison })
    }
    offset += size ?? 32
  }
  return undefined
}

/**
 * Resolves `functionName` (a name, or a full signature for an overloaded one) in `abi` and its argument
 * conditions.
 *
 * @internal
 */
export const resolveFunction = (
  abi: ReadonlyArray<unknown>,
  functionName: string,
  args: { readonly [name: string]: unknown } | undefined
): ResolvedFunction | ArgumentProblem => {
  const functions = abi.filter((item): item is AbiItem.AbiItem & { readonly name: string } =>
    typeof item === "object" && item !== null && (item as { type?: unknown }).type === "function"
  )
  const candidates = functionName.includes("(")
    ? functions.filter((item) => AbiItem.getSignature(item) === functionName.replaceAll(" ", ""))
    : functions.filter((item) => item.name === functionName)
  if (candidates.length === 0) {
    return { code: "UNKNOWN_FUNCTION", message: `the ABI has no function ${functionName}` }
  }
  if (candidates.length > 1) {
    return {
      code: "AMBIGUOUS_FUNCTION",
      message: `${functionName} is overloaded; name it by its signature, such as ${
        AbiItem.getSignature(candidates[0]!)
      }`
    }
  }

  const item = candidates[0]!
  const rules: Array<ArgumentRule> = []
  const unrestricted: Array<ResolvedFunction["unrestricted"][number]> = []
  const problem = resolveParameters(
    (item as { inputs: ReadonlyArray<Parameter> }).inputs,
    args,
    0,
    "",
    rules,
    unrestricted
  )
  if (problem !== undefined) return problem
  return { selector: AbiItem.getSelector(item), signature: AbiItem.getSignature(item), rules, unrestricted }
}
