import { Array as Arr, Console, Effect, FileSystem, Option, Path, String as Str } from "effect";
import { Command, Flag } from "effect/cli";

import { isAddressEqual } from "viem";

import { packageSources } from "../contracts/render.ts";
import {
  allDeployments,
  builtContracts,
  contractsDir,
  packageSourceDir,
} from "../contracts/workspace.ts";
import { CheckFailed, SetupError } from "../errors.ts";
import { Tools } from "../services/Tools.ts";

/**
 * Generates `packages/contracts/src` from the Foundry build and the deployment records, formatted
 * with oxfmt. With `check`, writes nothing and fails when the committed sources are stale. Every
 * record must sit at the address the current build deploys its label to.
 */
export const generate = Effect.fn("contracts.generate")(
  function* (check: boolean) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tools = yield* Tools;

    yield* tools.run("forge", ["build"], { cwd: contractsDir });
    const contracts = yield* builtContracts();
    const deployments = yield* allDeployments();

    const mismatches = Arr.flatMap(deployments, ({ chainId, contracts: records }) =>
      Arr.flatMap(contracts, (contract) => {
        const record = records[contract.label];
        return record === undefined || isAddressEqual(record.address, contract.address)
          ? []
          : [
              `${contract.label} on ${chainId}: recorded at ${record.address}, built for ${contract.address}`,
            ];
      }),
    );
    if (mismatches.length > 0) {
      return yield* CheckFailed.make({ check: "contracts generate", problems: mismatches });
    }

    const staging = yield* fs.makeTempDirectoryScoped({ prefix: "namera-contracts-" });
    const sources = packageSources(contracts, deployments);
    for (const [file, source] of sources)
      yield* fs.writeFileString(path.join(staging, file), source);
    yield* tools.run("pnpm", [
      "exec",
      "oxfmt",
      "-c",
      path.resolve(".config/oxfmt.config.ts"),
      staging,
    ]);

    const committed = (yield* fs.exists(packageSourceDir))
      ? yield* fs.readDirectory(packageSourceDir, { recursive: true })
      : [];
    const committedFiles = Arr.filter(committed, (file) => Str.endsWith(".ts")(file));

    if (check) {
      const stale: Array<string> = [];
      for (const file of sources.keys()) {
        const expected = yield* fs.readFileString(path.join(staging, file));
        const target = path.join(packageSourceDir, file);
        const exists = yield* fs.exists(target);
        const actual = exists
          ? yield* fs.readFileString(target).pipe(Effect.asSome)
          : Option.none<string>();
        if (Option.getOrUndefined(actual) !== expected) stale.push(target);
      }
      for (const file of committedFiles) {
        if (!sources.has(file)) stale.push(path.join(packageSourceDir, file));
      }
      if (stale.length > 0) {
        return yield* CheckFailed.make({
          check: "contracts generate --check",
          problems: [...stale, "run `pnpm contracts:generate` and commit the result"],
        });
      }
      return yield* Console.log(`contracts generate: up to date (${sources.size} files)`);
    }

    yield* fs.remove(packageSourceDir, { recursive: true }).pipe(Effect.ignore);
    yield* fs.makeDirectory(packageSourceDir, { recursive: true });
    for (const file of sources.keys()) {
      yield* fs.copyFile(path.join(staging, file), path.join(packageSourceDir, file));
    }
    return yield* Console.log(
      `contracts generate: wrote ${sources.size} files from ${contracts.length} contracts and ${deployments.length} deployment files`,
    );
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) })),
);

/** `contracts generate [--check]`. */
export const generateCommand = Command.make(
  "generate",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when the committed sources differ instead of writing them"),
    ),
  },
  ({ check }) => generate(check),
).pipe(
  Command.withDescription(
    "Generate @namera-ai/contracts from the Foundry build and the deployment records",
  ),
);
