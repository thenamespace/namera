import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import * as Str from "effect/String"

import { getAddress, getContractAddress, type Hex, keccak256, stringToHex } from "viem"

import { SetupError } from "../errors.ts"
import { type Chain, ChainDeployments, ChainsConfig, ContractsConfig, FoundryArtifact } from "./schema.ts"

/** The Foundry project, relative to the repository root. */
export const contractsDir = "contracts"

/** The generated sources of `@namera-ai/contracts`, relative to the repository root. */
export const packageSourceDir = "packages/contracts/src"

/** The Arachnid deterministic deployer every managed contract deploys through. */
export const factory = getAddress("0x4e59b44847b379578588920cA78FbF26c0B4956C")

/** A managed contract as the current build produces it: ABI, initcode and its CREATE2 address. */
export type BuiltContract = {
  readonly label: string
  readonly artifact: string
  readonly contract: string
  readonly version: number
  readonly abi: ReadonlyArray<unknown>
  readonly salt: Hex
  readonly initcodeHash: Hex
  readonly address: Hex
  readonly compiler: {
    readonly compiler: string
    readonly evmVersion: string
    readonly optimizerRuns: number
    readonly viaIR: boolean
  }
}

/** Decodes the JSON file at `file` with `schema`, reporting the file on failure. */
export const readJson = Effect.fnUntraced(function*<S extends Schema.Codec<unknown, unknown>>(
  file: string,
  schema: S
) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(file).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
    Effect.mapError((cause) => SetupError.make({ message: `${file}: ${String(cause)}` }))
  )
})

const labelVersion = /\.v(?<version>[1-9][0-9]*)$/

/**
 * Builds the managed contract list from `contracts.json` and the Foundry artifacts: the CREATE2
 * salt is `keccak256(label)` and the address commits to the initcode, exactly as `Deploy.s.sol`
 * computes them. Run `forge build` first.
 */
export const builtContracts = Effect.fn("workspace.builtContracts")(function*() {
  const path = yield* Path.Path
  const config = yield* readJson(
    path.join(contractsDir, "script", "config", "contracts.json"),
    ContractsConfig
  )

  return yield* Effect.forEach(
    config.contracts,
    (spec) =>
      Effect.gen(function*() {
        const [file, contract] = Str.split(spec.artifact, ":")
        const version = labelVersion.exec(spec.label)?.groups?.["version"]
        if (file === undefined || contract === undefined || version === undefined) {
          return yield* SetupError.make({
            message: `${spec.label}: expected an artifact "<File>.sol:<Name>" and a label ending in ".v<n>"`
          })
        }

        const artifact = yield* readJson(
          path.join(contractsDir, "out", file, `${contract}.json`),
          FoundryArtifact
        )
        const salt = keccak256(stringToHex(spec.label))
        const initcodeHash = keccak256(artifact.bytecode.object)
        const { settings } = artifact.metadata

        return {
          label: spec.label,
          artifact: spec.artifact,
          contract,
          version: Number(version),
          abi: artifact.abi,
          salt,
          initcodeHash,
          address: getContractAddress({
            opcode: "CREATE2",
            from: factory,
            salt,
            bytecodeHash: initcodeHash
          }),
          compiler: {
            compiler: artifact.metadata.compiler.version,
            evmVersion: settings.evmVersion,
            optimizerRuns: settings.optimizer.enabled ? settings.optimizer.runs : 0,
            viaIR: settings.viaIR ?? false
          }
        } satisfies BuiltContract
      }),
    { concurrency: 1 }
  )
})

/** The chains in `chains.json`. */
export const chains = Effect.fn("workspace.chains")(function*() {
  const path = yield* Path.Path
  const config = yield* readJson(path.join(contractsDir, "chains", "chains.json"), ChainsConfig)
  return config.chains
})

/** Which chains a command runs on. */
export type ChainSelection = {
  readonly slugs: ReadonlyArray<string>
  readonly network: Option.Option<"mainnet" | "testnet">
  readonly all: boolean
}

/** The chains `selection` names; every chain when `fallbackToAll` and nothing is selected. */
export const selectChains = (
  available: ReadonlyArray<Chain>,
  selection: ChainSelection,
  fallbackToAll: boolean
) => {
  if (selection.all) return Effect.succeed(available)
  if (Option.isSome(selection.network)) {
    const network = selection.network.value
    return Effect.succeed(Arr.filter(available, (chain) => chain.network === network))
  }
  if (selection.slugs.length > 0) {
    const unknown = Arr.filter(
      selection.slugs,
      (slug) => !Arr.some(available, (chain) => chain.slug === slug)
    )
    if (unknown.length > 0) {
      return Effect.fail(SetupError.make({ message: `unknown chain: ${Arr.join(unknown, ", ")}` }))
    }
    return Effect.succeed(
      Arr.filter(available, (chain) => Arr.contains(selection.slugs, chain.slug))
    )
  }
  if (fallbackToAll) return Effect.succeed(available)
  return Effect.fail(
    SetupError.make({ message: "select chains with --chain, --network or --all" })
  )
}

/** The deployment records file of `chainId`. */
export const deploymentsFile = (path: Path.Path, chainId: number) =>
  path.join(contractsDir, "deployments", `${chainId}.json`)

/** The committed deployment records of `chainId`, if any. */
export const readDeployments = Effect.fn("workspace.readDeployments")(function*(chainId: number) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const file = deploymentsFile(path, chainId)
  const exists = yield* fs
    .exists(file)
    .pipe(Effect.mapError((cause) => SetupError.make({ message: String(cause) })))
  if (!exists) return Option.none()
  const deployments = yield* readJson(file, ChainDeployments)
  return Option.some(deployments)
})

/** Every committed deployment records file, by ascending chain id. */
export const allDeployments = Effect.fn("workspace.allDeployments")(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dir = path.join(contractsDir, "deployments")
  const files = yield* fs
    .readDirectory(dir)
    .pipe(Effect.mapError((cause) => SetupError.make({ message: String(cause) })))
  const records = yield* Effect.forEach(
    Arr.filter(files, (file) => /^[0-9]+\.json$/.test(file)),
    (file) => readJson(path.join(dir, file), ChainDeployments),
    { concurrency: "unbounded" }
  )
  return Arr.sort(
    records,
    Order.mapInput(Order.Number, (record: ChainDeployments) => record.chainId)
  )
})
