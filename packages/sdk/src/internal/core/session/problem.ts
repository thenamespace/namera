/**
 * The stable codes of what `Session.from` refuses (malformed input), what `Session.validate` reports as errors
 * (sessions the contracts would refuse, or that would not do what they say) and as warnings.
 */
export const problemCodes = [
  "INVALID_ADDRESS",
  "INVALID_AMOUNT",
  "INVALID_PERIOD",
  "INVALID_TIME",
  "INVALID_SALT",
  "INVALID_SELECTOR",
  "INVALID_DATA",
  "INVALID_CONDITION",
  "UNKNOWN_FUNCTION",
  "AMBIGUOUS_FUNCTION",
  "UNKNOWN_ARGUMENT",
  "DYNAMIC_ARG_CONDITION",
  "UNSUPPORTED_CONDITION",
  "INVALID_TYPED_DATA",
  "UNSAFE_REQUIRED",
  "NO_CALL_POLICY",
  "EMPTY_WINDOW",
  "EXPIRY_IN_PAST",
  "CONFLICTING_LIMITS",
  "OVERLAPPING_CALLS",
  "FORBIDDEN_TARGET",
  "CONFIG_TOO_LARGE",
  "SIGN_MESSAGE_UNSUPPORTED",
  "TOO_MANY_EXECUTION_POLICIES",
  "EXECUTION_WITHOUT_LIMITS",
  "SIGNS_FOR_ACCOUNT",
  "GAS_LIMIT_REQUIRED",
  "DUPLICATE_POLICY",
  "UNRESTRICTED_ADDRESS_ARG",
  "UNRESTRICTED_AMOUNT_ARG",
  "RAW_CALL_POLICY",
  "ANY_CALL",
  "LONG_SESSION",
  "NO_EXPIRY"
] as const

/** One of `problemCodes`. */
export type ProblemCode = (typeof problemCodes)[number]

/**
 * One problem: its code, a sentence saying what is wrong, and the index of the policy it is about, if any.
 *
 * @internal
 */
export interface Problem {
  readonly code: ProblemCode
  readonly message: string
  readonly policy?: number
}

/** @internal */
export const problem = (code: ProblemCode, message: string, policy?: number): Problem =>
  policy === undefined ? { code, message } : { code, message, policy }
