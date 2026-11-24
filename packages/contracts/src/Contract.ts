/**
 * The compiler settings a contract version was built with. They are part of its initcode, so they
 * fix its CREATE2 address.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Compiler {
  readonly compiler: string
  readonly evmVersion: string
  readonly optimizerRuns: number
  readonly viaIR: boolean
}

/**
 * The provenance of a contract version on one chain: the hash of the runtime code read from the
 * chain, the source commit and compiler it was built from, and the transaction that created it.
 *
 * **Gotchas**
 *
 * The transaction fields are absent when the code was already on chain before Namera's deploy
 * pipeline ran there: anyone can deploy the same initcode through the CREATE2 factory.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Deployment {
  readonly runtimeCodeHash: `0x${string}`
  readonly transactionHash?: `0x${string}`
  readonly blockNumber?: bigint
  readonly blockHash?: `0x${string}`
  readonly deployer?: `0x${string}`
  readonly source: Compiler & { readonly commit: string }
}

/**
 * One version of a Namera contract: its versioned label, CREATE2 inputs and address, ABI, and its
 * deployment on each chain, keyed by chain id.
 *
 * **Details**
 *
 * The address is the same on every chain. A changed contract gets a new label and therefore a new
 * version and address; a version never changes after its first deployment.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Version<Abi> {
  readonly label: string
  readonly address: `0x${string}`
  readonly factory: `0x${string}`
  readonly salt: `0x${string}`
  readonly initcodeHash: `0x${string}`
  readonly compiler: Compiler
  readonly abi: Abi
  readonly deployments: Readonly<Partial<Record<number, Deployment>>>
}
