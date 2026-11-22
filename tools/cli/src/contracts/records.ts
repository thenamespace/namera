import { Array as Arr, Option, Result } from "effect"

import { getAddress, type Hex, isAddressEqual, keccak256, slice } from "viem"

import type { BroadcastRun, DeploymentRecord, DeploymentTransaction } from "./schema.ts"
import { type BuiltContract, factory } from "./workspace.ts"

/**
 * The transaction hash of each contract the broadcast run created, by label. A creation whose
 * initcode differs from the current build is a problem: the run was made from other sources.
 */
export const broadcastCreations = (run: BroadcastRun, contracts: ReadonlyArray<BuiltContract>) => {
  const hashes = new Map<string, Hex>()
  const problems: Array<string> = []

  for (const contract of contracts) {
    const creation = Arr.findFirst(
      run.transactions,
      (transaction) =>
        transaction.transactionType === "CREATE2" &&
        transaction.hash !== null &&
        transaction.contractAddress !== null &&
        isAddressEqual(transaction.contractAddress, contract.address)
    )
    if (Option.isNone(creation) || creation.value.hash === null) continue

    if (keccak256(slice(creation.value.transaction.input, 32)) !== contract.initcodeHash) {
      problems.push(`${contract.label}: the broadcast initcode differs from the current build`)
      continue
    }
    hashes.set(contract.label, creation.value.hash)
  }

  return { hashes, problems }
}

/** What is known about one contract on one chain when its record is written. */
export type Observation = {
  readonly code: Hex
  readonly previous: Option.Option<DeploymentRecord>
  readonly transaction: Option.Option<DeploymentTransaction>
  readonly commit: string
}

/**
 * The deployment record of `contract` given what the chain and the committed record say: none
 * while the contract is not deployed, the committed record while it still matches the chain, and
 * a new record from the current build otherwise. Fails with a problem when the committed record
 * and the chain disagree.
 */
export const deploymentRecord = (contract: BuiltContract, observation: Observation) => {
  const { code, previous } = observation

  if (code === "0x") {
    return Option.isSome(previous)
      ? Result.fail(`${contract.label}: recorded at ${previous.value.address}, but it has no code`)
      : Result.succeed(Option.none<DeploymentRecord>())
  }

  const runtimeCodeHash = keccak256(code)

  if (Option.isSome(previous)) {
    const record = previous.value
    if (!isAddressEqual(record.address, contract.address)) {
      return Result.fail(
        `${contract.label}: recorded at ${record.address}, but the current build deploys to ${contract.address}; changed code needs a new label`
      )
    }
    if (record.runtimeCodeHash !== runtimeCodeHash) {
      return Result.fail(`${contract.label}: the code on chain differs from the recorded code`)
    }
    return Result.succeed(Option.some(record))
  }

  return Result.succeed(
    Option.some<DeploymentRecord>({
      contract: contract.contract,
      artifact: contract.artifact,
      address: getAddress(contract.address),
      factory,
      salt: contract.salt,
      initcodeHash: contract.initcodeHash,
      runtimeCodeHash,
      ...Option.match(observation.transaction, {
        onNone: () => ({}),
        onSome: (transaction) => ({ transaction })
      }),
      source: { commit: observation.commit, ...contract.compiler }
    })
  )
}
