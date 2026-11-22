/**
 * The shapes every generated contract module shares: a contract `Version`, its `Deployment` on a
 * chain and the `Compiler` settings it was built with.
 *
 * @stability experimental
 * @since 0.1.0
 */
export type * as Contract from "./Contract.ts"

/**
 * Namera's `SmartSession` contract: ABI, CREATE2 address and deployment records, one export per
 * version (`SmartSession.v1`, …).
 *
 * @stability experimental
 * @since 0.1.0
 */
export * as SmartSession from "./SmartSession.ts"

/**
 * Namera's `ECDSASessionValidator` contract: ABI, CREATE2 address and deployment records, one
 * export per version (`ECDSASessionValidator.v1`, …).
 *
 * @stability experimental
 * @since 0.1.0
 */
export * as ECDSASessionValidator from "./ECDSASessionValidator.ts"

/**
 * The contracts Namera builds on but does not deploy, by version: EntryPoint 0.7 and the supported
 * smart accounts' factories, implementations and validators.
 *
 * @stability experimental
 * @since 0.1.0
 */
export * as External from "./External.ts"
