/**
 * The shapes every generated contract module shares: a contract `Version`, its `Deployment` on a
 * chain and the `Compiler` settings it was built with.
 *
 * @stability experimental
 * @since 2.0.0
 */
export type * as Contract from "./Contract.ts"

/**
 * Namera's `SmartSession` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`SmartSession.v1`, …) and one per part of it (`SmartSession.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as SmartSession from "./SmartSession.ts"

/**
 * Namera's `ECDSASessionValidator` contract: ABI, CREATE2 address and deployment records, one
 * export per version (`ECDSASessionValidator.v1`, …) and one per part of it
 * (`ECDSASessionValidator.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as ECDSASessionValidator from "./ECDSASessionValidator.ts"

/**
 * Namera's `WebAuthnValidator` contract: ABI, CREATE2 address and deployment records, one export
 * per version (`WebAuthnValidator.v1`, …) and one per part of it (`WebAuthnValidator.addressV1`,
 * …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as WebAuthnValidator from "./WebAuthnValidator.ts"

/**
 * Namera's `SessionHook` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`SessionHook.v1`, …) and one per part of it (`SessionHook.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as SessionHook from "./SessionHook.ts"

/**
 * Namera's `AllowPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`AllowPolicy.v1`, …) and one per part of it (`AllowPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as AllowPolicy from "./AllowPolicy.ts"

/**
 * Namera's `ArgPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`ArgPolicy.v1`, …) and one per part of it (`ArgPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as ArgPolicy from "./ArgPolicy.ts"

/**
 * Namera's `SpendPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`SpendPolicy.v1`, …) and one per part of it (`SpendPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as SpendPolicy from "./SpendPolicy.ts"

/**
 * Namera's `ValuePolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`ValuePolicy.v1`, …) and one per part of it (`ValuePolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as ValuePolicy from "./ValuePolicy.ts"

/**
 * Namera's `RateLimitPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`RateLimitPolicy.v1`, …) and one per part of it (`RateLimitPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as RateLimitPolicy from "./RateLimitPolicy.ts"

/**
 * Namera's `GasPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`GasPolicy.v1`, …) and one per part of it (`GasPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as GasPolicy from "./GasPolicy.ts"

/**
 * Namera's `ApprovalPolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`ApprovalPolicy.v1`, …) and one per part of it (`ApprovalPolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as ApprovalPolicy from "./ApprovalPolicy.ts"

/**
 * Namera's `SignaturePolicy` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`SignaturePolicy.v1`, …) and one per part of it (`SignaturePolicy.addressV1`, …).
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as SignaturePolicy from "./SignaturePolicy.ts"

/**
 * The contracts Namera builds on but does not deploy, by version: EntryPoint 0.7 and Kernel 3.3's
 * factory, factory staker, implementation and ECDSA validator.
 *
 * @stability experimental
 * @since 2.0.0
 */
export * as External from "./External.ts"
