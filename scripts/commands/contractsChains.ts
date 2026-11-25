import * as Arr from "effect/Array"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Console from "effect/Console"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Formatter from "effect/Formatter"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Predicate from "effect/Predicate"
import * as Rec from "effect/Record"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as Str from "effect/String"

import { getAddress } from "viem"

import * as Environment from "../contracts/environment.ts"
import { broadcastCreations, deploymentRecord } from "../contracts/records.ts"
import * as Rpc from "../contracts/rpc.ts"
import { BroadcastRun, type Chain, type DeploymentRecord, FoundryArtifact } from "../contracts/schema.ts"
import {
  isVerified,
  submissionStatus,
  type Verification,
  verificationProblems,
  verificationTable,
  type Verifier
} from "../contracts/verification.ts"
import {
  builtContracts,
  chains,
  type ChainSelection,
  contractsDir,
  deploymentsFile,
  readDeployments,
  readJson,
  selectChains
} from "../contracts/workspace.ts"
import { CheckFailed, SetupError } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

const selection = {
  slugs: Flag.String("chain").pipe(
    Flag.atLeast(0),
    Flag.withDescription("Chain slug from contracts/chains/chains.json (repeatable)")
  ),
  network: Flag.Literals("network", ["mainnet", "testnet"]).pipe(
    Flag.optional,
    Flag.withDescription("Every chain of one network")
  ),
  all: Flag.Boolean("all").pipe(Flag.withDefault(false), Flag.withDescription("Every chain")),
  rpcUrl: Flag.String("rpc-url").pipe(
    Flag.optional,
    Flag.withDescription(
      "RPC endpoint to use instead of the chain's configured one (one chain only)"
    )
  )
}

type SelectionFlags = ChainSelection & { readonly rpcUrl: Option.Option<string> }

const selectedChains = Effect.fn("contracts.selectedChains")(function*(
  flags: SelectionFlags,
  fallbackToAll: boolean
) {
  const available = yield* chains()
  const selected = yield* selectChains(available, flags, fallbackToAll)
  if (Option.isSome(flags.rpcUrl) && selected.length !== 1) {
    return yield* SetupError.make({ message: "--rpc-url needs exactly one chain" })
  }
  return selected
})

const failureMessage = (failure: unknown) => {
  if (Schema.is(CheckFailed)(failure)) return Arr.join(failure.problems, "\n")
  if (Predicate.hasProperty(failure, "message")) return String(failure.message)
  if (Predicate.hasProperty(failure, "output")) return String(failure.output)
  return String(failure)
}

const forEachChain = Effect.fnUntraced(function*<E, R>(
  command: string,
  selected: ReadonlyArray<Chain>,
  run: (chain: Chain) => Effect.Effect<unknown, E, R>
) {
  const failed: Array<string> = []
  for (const chain of selected) {
    yield* Console.log(`\n── ${chain.name} (${chain.id}) ──`)
    const outcome = yield* Effect.result(run(chain))
    if (Result.isFailure(outcome)) {
      yield* Console.error(failureMessage(outcome.failure))
      failed.push(chain.slug)
    }
  }
  if (failed.length > 0) {
    return yield* CheckFailed.make({
      check: command,
      problems: [`failed: ${Arr.join(failed, ", ")}`]
    })
  }
  return yield* Effect.void
})

const forge = Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
  const tools = yield* Tools
  return yield* tools.run("forge", args, { cwd: contractsDir, inherit: true })
})

const git = Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
  const tools = yield* Tools
  const output = yield* tools.run("git", args)
  return Str.trim(output)
})

const deploymentSources = ["src", "script", "foundry.toml", "soldeer.lock", "remappings.txt"]

const requireCleanSources = Effect.gen(function*() {
  const changes = yield* git([
    "status",
    "--porcelain",
    "--",
    ...Arr.map(deploymentSources, (source) => `${contractsDir}/${source}`)
  ])
  if (changes.length > 0) {
    return yield* SetupError.make({
      message: `commit the contract sources first; deployment records name the commit they were built from:\n${changes}`
    })
  }
  return yield* Effect.void
})

/**
 * Writes `contracts/deployments/<chainId>.json` from the chain: every managed contract with code
 * at its CREATE2 address gets a record, with the creating transaction from the latest broadcast
 * run (confirmed against the node's receipt). Committed records are kept while they match the chain.
 */
export const record = Effect.fn("contracts.record")(
  function*(chain: Chain, url: string) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools

    const served = yield* Rpc.chainId(url)
    if (served !== chain.id) {
      return yield* SetupError.make({
        message: `${url} serves chain ${served}, not ${chain.name} (${chain.id})`
      })
    }

    const contracts = yield* builtContracts()
    const previous = yield* readDeployments(chain.id)
    const commit = yield* git(["rev-parse", "HEAD"])

    const broadcastFile = path.join(
      contractsDir,
      "broadcast",
      "Deploy.s.sol",
      String(chain.id),
      "run-latest.json"
    )
    const broadcast = (yield* fs.exists(broadcastFile))
      ? yield* readJson(broadcastFile, BroadcastRun).pipe(Effect.asSome)
      : Option.none()
    const creations = Option.match(broadcast, {
      onNone: () => ({ hashes: new Map<string, `0x${string}`>(), problems: [] }),
      onSome: (run) => broadcastCreations(run, contracts)
    })
    const problems = [...creations.problems]
    const records: Record<string, DeploymentRecord> = {
      ...Option.match(previous, { onNone: () => ({}), onSome: (file) => file.contracts })
    }

    for (const contract of contracts) {
      const code = yield* Rpc.code(url, contract.address)
      const hash = creations.hashes.get(contract.label)
      const receipt = hash === undefined ? null : yield* Rpc.receipt(url, hash)
      if (hash !== undefined && (receipt === null || receipt.status !== "0x1")) {
        problems.push(
          `${contract.label}: transaction ${hash} is not a successful receipt on chain`
        )
        continue
      }

      const outcome = deploymentRecord(contract, {
        code,
        previous: Option.fromNullishOr(records[contract.label]),
        transaction: Option.map(Option.fromNullishOr(receipt), (found) => ({
          transactionHash: found.transactionHash,
          blockNumber: Number(BigInt(found.blockNumber)),
          blockHash: found.blockHash,
          deployer: getAddress(found.from)
        })),
        commit
      })
      if (Result.isFailure(outcome)) {
        problems.push(outcome.failure)
        continue
      }
      if (Option.isSome(outcome.success)) {
        records[contract.label] = outcome.success.value
        yield* Console.log(`recorded ${contract.label} at ${contract.address}`)
      } else {
        yield* Console.log(`not deployed: ${contract.label}`)
      }
    }

    if (problems.length > 0) {
      return yield* CheckFailed.make({ check: "contracts record", problems })
    }
    if (Rec.isEmptyRecord(records)) {
      return yield* Console.log("nothing deployed; no records written")
    }

    const file = deploymentsFile(path, chain.id)
    yield* fs.writeFileString(
      file,
      `${Formatter.formatJson({ chainId: chain.id, contracts: records }, { space: 2 })}\n`
    )
    yield* tools.run("pnpm", ["exec", "dprint", "fmt", file])
    return yield* Console.log(`wrote ${file}`)
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

/** The parts of `forge config --json` that name the compilation profiles. */
const ForgeProfiles = Schema.Struct({
  optimizer_runs: Schema.Int,
  via_ir: Schema.Boolean,
  additional_compiler_profiles: Schema.Array(Schema.Struct({
    name: Schema.String,
    optimizer_runs: Schema.NullOr(Schema.Int),
    via_ir: Schema.NullOr(Schema.Boolean)
  }))
})

/** Each compilation profile in `foundry.toml` with its settings; unset settings are the default profile's. */
const compilationProfiles = Effect.gen(function*() {
  const tools = yield* Tools
  const config = yield* tools.run("forge", ["config", "--json"], { cwd: contractsDir }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(ForgeProfiles))),
    Effect.mapError((cause) => SetupError.make({ message: `forge config: ${String(cause)}` }))
  )
  return [
    { name: "default", runs: config.optimizer_runs, viaIR: config.via_ir },
    ...Arr.map(config.additional_compiler_profiles, (profile) => ({
      name: profile.name,
      runs: profile.optimizer_runs ?? config.optimizer_runs,
      viaIR: profile.via_ir ?? config.via_ir
    }))
  ]
})

/**
 * The profile a recorded contract was built with, matched on the settings the record keeps: `forge verify-contract`
 * needs it once `foundry.toml` has more than one.
 */
const profileOf = (
  profiles: ReadonlyArray<{ readonly name: string; readonly runs: number; readonly viaIR: boolean }>,
  source: { readonly optimizerRuns: number; readonly viaIR: boolean }
) =>
  Arr.findFirst(profiles, (profile) => profile.runs === source.optimizerRuns && profile.viaIR === source.viaIR).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(SetupError.make({
          message:
            `no compilation profile in foundry.toml builds with ${source.optimizerRuns} runs, viaIR ${source.viaIR}`
        })),
      onSome: (profile) => Effect.succeed(profile.name)
    })
  )

/**
 * The `path:Contract` identifier of an artifact (`File.sol:Contract`), read from its build: with a compilation profile,
 * `forge verify-contract` resolves only source paths.
 */
const sourceIdentifier = Effect.fnUntraced(function*(artifact: string) {
  const path = yield* Path.Path
  const [file, contract] = Str.split(artifact, ":")
  const build = yield* readJson(path.join(contractsDir, "out", file ?? "", `${contract ?? ""}.json`), FoundryArtifact)
  const target = Arr.head(Rec.toEntries(build.metadata.settings.compilationTarget))
  if (Option.isNone(target)) {
    return yield* SetupError.make({ message: `${artifact}: the build names no compilation target` })
  }
  const [source, name] = target.value
  return `${source}:${name}`
})

/** How long one `forge verify-contract --watch` may wait for the verifier before the contract counts as pending. */
const submissionTimeout = Duration.minutes(3.5)

/** Pending submissions are looked up this many times, this far apart, before verification gives up on them. */
const recheckRounds = 6
const recheckDelay = Duration.seconds(30)

/** Submits one contract to `verifier` with `forge verify-contract --watch`, waiting at most `submissionTimeout`. */
const submit = Effect.fnUntraced(function*(
  chain: Chain,
  verifier: Verifier,
  contract: { readonly address: string; readonly identifier: string; readonly profile: string },
  etherscanKey: string
) {
  const tools = yield* Tools
  const submission = yield* tools.run("forge", [
    "verify-contract",
    contract.address,
    contract.identifier,
    "--chain",
    String(chain.id),
    "--verifier",
    verifier,
    "--watch",
    "--compilation-profile",
    contract.profile,
    ...(verifier === "etherscan" ? ["--etherscan-api-key", etherscanKey] : [])
  ], { cwd: contractsDir }).pipe(Effect.timeoutOption(submissionTimeout), Effect.result)

  if (Result.isSuccess(submission)) {
    if (Option.isSome(submission.success)) return "verified" as const
    yield* Console.log(`  no result after ${Duration.format(submissionTimeout)}: pending`)
    return "pending" as const
  }
  const status = submissionStatus(submission.failure.output)
  yield* Console.log(status === "pending" ? "  accepted, still pending" : Str.trim(submission.failure.output))
  return status
})

/**
 * Verifies every recorded contract of `chain` on each of its verifiers. Each contract's status is read from the
 * verifier's API first, so verified contracts are skipped; the rest are submitted with a bounded wait, and those still
 * pending are looked up again for a few minutes. Fails, after printing the table, when a contract is still pending or
 * failed.
 */
export const verify = Effect.fn("contracts.verify")(function*(chain: Chain) {
  const deployments = yield* readDeployments(chain.id)
  if (Option.isNone(deployments)) {
    return yield* Console.log("no deployment records; nothing to verify")
  }
  const etherscanKey = yield* Environment.etherscanApiKey
  const profiles = yield* compilationProfiles

  const key = Option.getOrElse(etherscanKey, () => "")

  const lookup = (verifier: Verifier, address: string) =>
    isVerified(verifier, chain.id, address, key).pipe(
      Effect.tapError((error) => Console.log(`  ${verifier} lookup failed: ${error.message}`)),
      Effect.orElseSucceed(() => false)
    )

  let verifications: Array<Verification> = []
  for (const [label, entry] of Rec.toEntries(deployments.value.contracts)) {
    const profile = yield* profileOf(profiles, entry.source)
    const identifier = yield* sourceIdentifier(entry.artifact)
    for (const verifier of chain.verifiers) {
      const verification = { label, address: entry.address, verifier }
      if (verifier === "etherscan" && Option.isNone(etherscanKey)) {
        verifications.push({ ...verification, status: "skipped" })
        continue
      }
      if (yield* lookup(verifier, entry.address)) {
        yield* Console.log(`${label} on ${verifier}: already verified`)
        verifications.push({ ...verification, status: "verified" })
        continue
      }
      yield* Console.log(`${label} on ${verifier}: submitting`)
      const status = yield* submit(chain, verifier, { address: entry.address, identifier, profile }, key)
      verifications.push({ ...verification, status })
    }
  }

  for (let round = 1; round <= recheckRounds; round++) {
    const pending = Arr.filter(verifications, (verification) => verification.status === "pending")
    if (pending.length === 0) break
    yield* Console.log(
      `\n${pending.length} pending; checking again in ${Duration.format(recheckDelay)} (${round}/${recheckRounds})`
    )
    yield* Effect.sleep(recheckDelay)
    verifications = yield* Effect.forEach(verifications, (verification) =>
      verification.status === "pending"
        ? lookup(verification.verifier, verification.address).pipe(
          Effect.map((verified): Verification => verified ? { ...verification, status: "verified" } : verification)
        )
        : Effect.succeed(verification))
  }

  yield* Console.log(`\n${verificationTable(chain.verifiers, verifications)}`)
  if (Option.isNone(etherscanKey) && Arr.contains(chain.verifiers, "etherscan")) {
    yield* Console.log("etherscan skipped: ETHERSCAN_API_KEY is not set")
  }
  const problems = verificationProblems(chain, verifications)
  if (problems.length > 0) {
    return yield* CheckFailed.make({ check: "contracts verify", problems })
  }
  return yield* Effect.void
})

const statusCommand = Command.make("status", selection, (flags) =>
  Effect.gen(function*() {
    const selected = yield* selectedChains(flags, true)
    yield* forge(["build"])
    yield* forEachChain("contracts status", selected, (chain) =>
      Effect.flatMap(Environment.rpcUrl(chain, flags.rpcUrl), (url) =>
        forge(["script", "script/Status.s.sol", "--rpc-url", url])))
  })).pipe(Command.withDescription("Pre-flight checks and deployment state per chain (read-only)"))

const deployCommand = Command.make("deploy", selection, (flags) =>
  Effect.gen(function*() {
    const selected = yield* selectedChains(flags, false)
    const account = yield* Environment.deployerAccount
    yield* requireCleanSources
    yield* forge(["build"])
    yield* forEachChain("contracts deploy", selected, (chain) =>
      Effect.gen(function*() {
        const url = yield* Environment.rpcUrl(chain, flags.rpcUrl)
        yield* forge([
          "script",
          "script/Deploy.s.sol",
          "--rpc-url",
          url,
          "--account",
          account,
          "--broadcast"
        ])
        yield* record(chain, url)
        yield* verify(chain)
      }))
  })).pipe(
    Command.withDescription("Deploy missing contracts, record their provenance and verify them")
  )

const recordCommand = Command.make("record", selection, (flags) =>
  Effect.gen(function*() {
    const selected = yield* selectedChains(flags, false)
    yield* forge(["build"])
    yield* forEachChain("contracts record", selected, (chain) =>
      Effect.flatMap(Environment.rpcUrl(chain, flags.rpcUrl), (url) =>
        record(chain, url)))
  })).pipe(
    Command.withDescription("Write deployment records from the chain and the latest broadcast run")
  )

const verifyCommand = Command.make("verify", selection, (flags) =>
  Effect.gen(function*() {
    const selected = yield* selectedChains(flags, false)
    yield* forge(["build"])
    yield* forEachChain("contracts verify", selected, verify)
  })).pipe(Command.withDescription("Verify recorded contracts on Sourcify and Etherscan"))

/** `status`, `deploy`, `record` and `verify`: the per-chain deployment commands. */
export const chainCommands = [statusCommand, deployCommand, recordCommand, verifyCommand] as const
