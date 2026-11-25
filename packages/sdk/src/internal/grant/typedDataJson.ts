import * as Predicate from "effect/Predicate"

// `eth_signTypedData_v4` sends EIP-712 typed data as JSON: integers arrive as decimal or hex strings (viem writes
// bigints as decimal strings), which the session's signing policies compare and EIP-712 encodes as integers. They are
// read back as bigints by walking the message along its types.

type Types = Readonly<Record<string, ReadonlyArray<{ readonly name: string; readonly type: string }>>>

/**
 * Typed data read from JSON, its integers as bigints.
 *
 * @internal
 */
export interface TypedData {
  readonly domain?: Record<string, unknown> | undefined
  readonly types: Types
  readonly primaryType: string
  readonly message: Record<string, unknown>
}

const isInteger = (type: string) => /^u?int\d*$/.test(type)

const toBigInt = (value: unknown): unknown =>
  Predicate.isString(value) || Predicate.isNumber(value) ? BigInt(value) : value

const read = (types: Types, type: string, value: unknown): unknown => {
  const array = /^(.*)\[\d*\]$/.exec(type)
  if (array !== null) return Array.isArray(value) ? value.map((entry) => read(types, array[1]!, entry)) : value
  if (isInteger(type)) return toBigInt(value)
  const fields = types[type]
  if (fields === undefined || !Predicate.isObject(value)) return value
  const struct: Record<string, unknown> = { ...value }
  for (const field of fields) {
    if (field.name in struct) struct[field.name] = read(types, field.type, struct[field.name])
  }
  return struct
}

/**
 * Reads `eth_signTypedData_v4`'s typed data (a JSON string or an object), or `undefined` when it isn't typed data.
 *
 * @internal
 */
export const fromJson = (input: unknown): TypedData | undefined => {
  let value: unknown = input
  if (Predicate.isString(input)) {
    try {
      value = JSON.parse(input)
    } catch {
      return undefined
    }
  }
  if (
    !Predicate.hasProperty(value, "types") || !Predicate.isObject(value.types)
    || !Predicate.hasProperty(value, "primaryType") || !Predicate.isString(value.primaryType)
    || !Predicate.hasProperty(value, "message") || !Predicate.isObject(value.message)
  ) return undefined
  const types = value.types as Types
  const domain = Predicate.hasProperty(value, "domain") && Predicate.isObject(value.domain)
    ? value.domain as Record<string, unknown>
    : undefined

  try {
    return {
      ...(domain === undefined ? {} : {
        domain: domain.chainId === undefined ? domain : { ...domain, chainId: Number(toBigInt(domain.chainId)) }
      }),
      types,
      primaryType: value.primaryType,
      message: read(types, value.primaryType, value.message) as Record<string, unknown>
    }
  } catch {
    // An integer field that isn't one.
    return undefined
  }
}
