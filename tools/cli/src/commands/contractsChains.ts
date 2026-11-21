import {
  Array as Arr,
  Console,
  Effect,
  FileSystem,
  Formatter,
  Option,
  Path,
  Predicate,
  Record as Rec,
  Result,
  Schema,
  String as Str,
} from "effect";
import { Command, Flag } from "effect/cli";

import { getAddress } from "viem";

import * as Environment from "../contracts/environment.ts";
import { broadcastCreations, deploymentRecord } from "../contracts/records.ts";
import * as Rpc from "../contracts/rpc.ts";
import { BroadcastRun, type Chain, type DeploymentRecord } from "../contracts/schema.ts";
import {
  builtContracts,
  chains,
  contractsDir,
  deploymentsFile,
  readDeployments,
  readJson,
  selectChains,
  type ChainSelection,
} from "../contracts/workspace.ts";
import { CheckFailed, SetupError } from "../errors.ts";
import { Tools } from "../services/Tools.ts";

const selection = {
  slugs: Flag.String("chain").pipe(
    Flag.atLeast(0),
    Flag.withDescription("Chain slug from contracts/chains/chains.json (repeatable)"),
  ),
  network: Flag.Literals("network", ["mainnet", "testnet"]).pipe(
    Flag.optional,
    Flag.withDescription("Every chain of one network"),
  ),
  all: Flag.Boolean("all").pipe(Flag.withDefault(false), Flag.withDescription("Every chain")),
  rpcUrl: Flag.String("rpc-url").pipe(
    Flag.optional,
    Flag.withDescription(
      "RPC endpoint to use instead of the chain's configured one (one chain only)",
    ),
  ),
};

type SelectionFlags = ChainSelection & { readonly rpcUrl: Option.Option<string> };

const selectedChains = Effect.fn("contracts.selectedChains")(function* (
  flags: SelectionFlags,
  fallbackToAll: boolean,
) {
  const available = yield* chains();
  const selected = yield* selectChains(available, flags, fallbackToAll);
  if (Option.isSome(flags.rpcUrl) && selected.length !== 1) {
    return yield* SetupError.make({ message: "--rpc-url needs exactly one chain" });
  }
  return selected;
});

const failureMessage = (failure: unknown) => {
  if (Schema.is(CheckFailed)(failure)) return Arr.join(failure.problems, "\n");
  if (Predicate.hasProperty(failure, "message")) return String(failure.message);
  if (Predicate.hasProperty(failure, "output")) return String(failure.output);
  return String(failure);
};

const forEachChain = <E, R>(
  command: string,
  selected: ReadonlyArray<Chain>,
  run: (chain: Chain) => Effect.Effect<unknown, E, R>,
) =>
  Effect.gen(function* () {
    const failed: Array<string> = [];
    for (const chain of selected) {
      yield* Console.log(`\n── ${chain.name} (${chain.id}) ──`);
      const outcome = yield* Effect.result(run(chain));
      if (Result.isFailure(outcome)) {
        yield* Console.error(failureMessage(outcome.failure));
        failed.push(chain.slug);
      }
    }
    if (failed.length > 0) {
      return yield* CheckFailed.make({
        check: command,
        problems: [`failed: ${Arr.join(failed, ", ")}`],
      });
    }
    return yield* Effect.void;
  });

const forge = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
  const tools = yield* Tools;
  return yield* tools.run("forge", args, { cwd: contractsDir, inherit: true });
});

const git = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
  const tools = yield* Tools;
  const output = yield* tools.run("git", args);
  return Str.trim(output);
});

const deploymentSources = ["src", "script", "foundry.toml", "soldeer.lock", "remappings.txt"];

const requireCleanSources = Effect.gen(function* () {
  const changes = yield* git([
    "status",
    "--porcelain",
    "--",
    ...Arr.map(deploymentSources, (source) => `${contractsDir}/${source}`),
  ]);
  if (changes.length > 0) {
    return yield* SetupError.make({
      message: `commit the contract sources first; deployment records name the commit they were built from:\n${changes}`,
    });
  }
  return yield* Effect.void;
});

/**
 * Writes `contracts/deployments/<chainId>.json` from the chain: every managed contract with code
 * at its CREATE2 address gets a record, with the creating transaction from the latest broadcast
 * run (confirmed against the node's receipt). Committed records are kept while they match the chain.
 */
export const record = Effect.fn("contracts.record")(
  function* (chain: Chain, url: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tools = yield* Tools;

    const served = yield* Rpc.chainId(url);
    if (served !== chain.id) {
      return yield* SetupError.make({
        message: `${url} serves chain ${served}, not ${chain.name} (${chain.id})`,
      });
    }

    const contracts = yield* builtContracts();
    const previous = yield* readDeployments(chain.id);
    const commit = yield* git(["rev-parse", "HEAD"]);

    const broadcastFile = path.join(
      contractsDir,
      "broadcast",
      "Deploy.s.sol",
      String(chain.id),
      "run-latest.json",
    );
    const broadcast = (yield* fs.exists(broadcastFile))
      ? yield* readJson(broadcastFile, BroadcastRun).pipe(Effect.asSome)
      : Option.none();
    const creations = Option.match(broadcast, {
      onNone: () => ({ hashes: new Map<string, `0x${string}`>(), problems: [] }),
      onSome: (run) => broadcastCreations(run, contracts),
    });
    const problems = [...creations.problems];
    const records: Record<string, DeploymentRecord> = {
      ...Option.match(previous, { onNone: () => ({}), onSome: (file) => file.contracts }),
    };

    for (const contract of contracts) {
      const code = yield* Rpc.code(url, contract.address);
      const hash = creations.hashes.get(contract.label);
      const receipt = hash === undefined ? null : yield* Rpc.receipt(url, hash);
      if (hash !== undefined && (receipt === null || receipt.status !== "0x1")) {
        problems.push(
          `${contract.label}: transaction ${hash} is not a successful receipt on chain`,
        );
        continue;
      }

      const outcome = deploymentRecord(contract, {
        code,
        previous: Option.fromNullishOr(records[contract.label]),
        transaction: Option.map(Option.fromNullishOr(receipt), (found) => ({
          transactionHash: found.transactionHash,
          blockNumber: Number(BigInt(found.blockNumber)),
          blockHash: found.blockHash,
          deployer: getAddress(found.from),
        })),
        commit,
      });
      if (Result.isFailure(outcome)) {
        problems.push(outcome.failure);
        continue;
      }
      if (Option.isSome(outcome.success)) {
        records[contract.label] = outcome.success.value;
        yield* Console.log(`recorded ${contract.label} at ${contract.address}`);
      } else {
        yield* Console.log(`not deployed: ${contract.label}`);
      }
    }

    if (problems.length > 0)
      return yield* CheckFailed.make({ check: "contracts record", problems });
    if (Rec.isEmptyRecord(records))
      return yield* Console.log("nothing deployed; no records written");

    const file = deploymentsFile(path, chain.id);
    yield* fs.writeFileString(
      file,
      `${Formatter.formatJson({ chainId: chain.id, contracts: records }, { space: 2 })}\n`,
    );
    yield* tools.run("pnpm", ["exec", "oxfmt", "-c", ".config/oxfmt.config.ts", file]);
    return yield* Console.log(`wrote ${file}`);
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) })),
);

/** Verifies every recorded contract of `chain` on each of its verifiers. */
export const verify = Effect.fn("contracts.verify")(function* (chain: Chain) {
  const deployments = yield* readDeployments(chain.id);
  if (Option.isNone(deployments))
    return yield* Console.log("no deployment records; nothing to verify");
  const etherscanKey = yield* Environment.etherscanApiKey;

  for (const [label, entry] of Rec.toEntries(deployments.value.contracts)) {
    for (const verifier of chain.verifiers) {
      if (verifier === "etherscan" && Option.isNone(etherscanKey)) {
        yield* Console.log(`skip etherscan for ${label}: ETHERSCAN_API_KEY is not set`);
        continue;
      }
      yield* forge([
        "verify-contract",
        entry.address,
        entry.artifact,
        "--chain",
        String(chain.id),
        "--verifier",
        verifier,
        "--watch",
        ...(verifier === "etherscan" && Option.isSome(etherscanKey)
          ? ["--etherscan-api-key", etherscanKey.value]
          : []),
      ]);
    }
  }
  return yield* Effect.void;
});

const statusCommand = Command.make("status", selection, (flags) =>
  Effect.gen(function* () {
    const selected = yield* selectedChains(flags, true);
    yield* forge(["build"]);
    yield* forEachChain("contracts status", selected, (chain) =>
      Effect.flatMap(Environment.rpcUrl(chain, flags.rpcUrl), (url) =>
        forge(["script", "script/Status.s.sol", "--rpc-url", url]),
      ),
    );
  }),
).pipe(Command.withDescription("Pre-flight checks and deployment state per chain (read-only)"));

const deployCommand = Command.make("deploy", selection, (flags) =>
  Effect.gen(function* () {
    const selected = yield* selectedChains(flags, false);
    const account = yield* Environment.deployerAccount;
    yield* requireCleanSources;
    yield* forge(["build"]);
    yield* forEachChain("contracts deploy", selected, (chain) =>
      Effect.gen(function* () {
        const url = yield* Environment.rpcUrl(chain, flags.rpcUrl);
        yield* forge([
          "script",
          "script/Deploy.s.sol",
          "--rpc-url",
          url,
          "--account",
          account,
          "--broadcast",
        ]);
        yield* record(chain, url);
        yield* verify(chain);
      }),
    );
  }),
).pipe(
  Command.withDescription("Deploy missing contracts, record their provenance and verify them"),
);

const recordCommand = Command.make("record", selection, (flags) =>
  Effect.gen(function* () {
    const selected = yield* selectedChains(flags, false);
    yield* forge(["build"]);
    yield* forEachChain("contracts record", selected, (chain) =>
      Effect.flatMap(Environment.rpcUrl(chain, flags.rpcUrl), (url) => record(chain, url)),
    );
  }),
).pipe(
  Command.withDescription("Write deployment records from the chain and the latest broadcast run"),
);

const verifyCommand = Command.make("verify", selection, (flags) =>
  Effect.gen(function* () {
    const selected = yield* selectedChains(flags, false);
    yield* forEachChain("contracts verify", selected, verify);
  }),
).pipe(Command.withDescription("Verify recorded contracts on Sourcify and Etherscan"));

/** `status`, `deploy`, `record` and `verify`: the per-chain deployment commands. */
export const chainCommands = [statusCommand, deployCommand, recordCommand, verifyCommand] as const;
