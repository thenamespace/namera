import { Schema } from "effect";

/** `0x`-prefixed hex data of any length. */
export const Hex = Schema.TemplateLiteral(["0x", Schema.String]).check(
  Schema.isPattern(/^0x[0-9a-fA-F]*$/),
);

/** A 20-byte address, in any letter case. */
export const Address = Schema.TemplateLiteral(["0x", Schema.String]).check(
  Schema.isPattern(/^0x[0-9a-fA-F]{40}$/),
);

/** A 32-byte hash or word. */
export const Bytes32 = Schema.TemplateLiteral(["0x", Schema.String]).check(
  Schema.isPattern(/^0x[0-9a-fA-F]{64}$/),
);

/** `contracts/script/config/contracts.json`: every contract the deploy pipeline manages. */
export const ContractsConfig = Schema.Struct({
  contracts: Schema.Array(Schema.Struct({ artifact: Schema.String, label: Schema.String })),
});

/** One chain from `contracts/chains/chains.json`. */
export const Chain = Schema.Struct({
  id: Schema.Int,
  slug: Schema.String,
  name: Schema.String,
  network: Schema.Literals(["mainnet", "testnet"]),
  rpcEnv: Schema.String,
  publicRpc: Schema.String,
  verifiers: Schema.Array(Schema.Literals(["sourcify", "etherscan"])),
});

/** A chain the deploy pipeline supports. */
export type Chain = typeof Chain.Type;

/** `contracts/chains/chains.json`. */
export const ChainsConfig = Schema.Struct({ chains: Schema.Array(Chain) });

/** The parts of a Foundry build artifact (`contracts/out/<File>.sol/<Name>.json`) the tooling reads. */
export const FoundryArtifact = Schema.Struct({
  abi: Schema.Array(Schema.Unknown),
  bytecode: Schema.Struct({ object: Hex }),
  metadata: Schema.Struct({
    compiler: Schema.Struct({ version: Schema.String }),
    settings: Schema.Struct({
      evmVersion: Schema.String,
      optimizer: Schema.Struct({ enabled: Schema.Boolean, runs: Schema.Int }),
      viaIR: Schema.optionalKey(Schema.Boolean),
    }),
  }),
});

/** The compiler settings a contract was built with; they determine its bytecode and address. */
export const CompilerSettings = Schema.Struct({
  compiler: Schema.String,
  evmVersion: Schema.String,
  optimizerRuns: Schema.Int,
  viaIR: Schema.Boolean,
});

/** The transaction that created a contract, read back from the chain. */
export const DeploymentTransaction = Schema.Struct({
  transactionHash: Bytes32,
  blockNumber: Schema.Int,
  blockHash: Bytes32,
  deployer: Address,
});

/** The transaction that created a contract, read back from the chain. */
export type DeploymentTransaction = typeof DeploymentTransaction.Type;

/**
 * Provenance of one contract on one chain: what was deployed (artifact, initcode and runtime code
 * hashes, CREATE2 inputs), from which source and compiler, and by which transaction. `transaction`
 * is absent when the code was already on chain and no deploy of this pipeline created it.
 */
export const DeploymentRecord = Schema.Struct({
  contract: Schema.String,
  artifact: Schema.String,
  address: Address,
  factory: Address,
  salt: Bytes32,
  initcodeHash: Bytes32,
  runtimeCodeHash: Bytes32,
  transaction: Schema.optionalKey(DeploymentTransaction),
  source: Schema.Struct({ commit: Schema.String, ...CompilerSettings.fields }),
});

/** Provenance of one contract on one chain. */
export type DeploymentRecord = typeof DeploymentRecord.Type;

/** `contracts/deployments/<chainId>.json`: every managed contract deployed on the chain, by label. */
export const ChainDeployments = Schema.Struct({
  chainId: Schema.Int,
  contracts: Schema.Record(Schema.String, DeploymentRecord),
});

/** Every managed contract deployed on one chain, by label. */
export type ChainDeployments = typeof ChainDeployments.Type;

/** The parts of a `forge script --broadcast` run file (`run-latest.json`) the tooling reads. */
export const BroadcastRun = Schema.Struct({
  chain: Schema.Int,
  transactions: Schema.Array(
    Schema.Struct({
      hash: Schema.NullOr(Bytes32),
      transactionType: Schema.String,
      contractAddress: Schema.NullOr(Address),
      transaction: Schema.Struct({ input: Hex }),
    }),
  ),
});

/** A `forge script --broadcast` run. */
export type BroadcastRun = typeof BroadcastRun.Type;

/** An Ethereum JSON-RPC transaction receipt, as far as deploy records need it. */
export const TransactionReceipt = Schema.Struct({
  transactionHash: Bytes32,
  blockNumber: Hex,
  blockHash: Bytes32,
  from: Address,
  status: Hex,
});
