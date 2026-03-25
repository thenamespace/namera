import { Console, Effect, Schema } from "effect";
import { Command } from "effect/unstable/cli";

import { ImportSmartAccountParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SmartAccountManager } from "@/layers";
import { SmartAccountManagerError } from "@/layers/smart-account";

const handler = () =>
  Effect.gen(function* () {
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;

    const globalFlags = yield* getGlobalFlags();

    if (globalFlags.params._tag === "None") {
      return yield* Effect.fail(
        new SmartAccountManagerError({
          code: "SmartAccountImportError",
          message: "Smart Account import is only supported via JSON params",
        }),
      );
    }

    const params = Schema.decodeUnknownSync(
      Schema.fromJsonString(ImportSmartAccountParams),
    )(globalFlags.params.value);

    const res = yield* smartAccountManager.importSmartAccount(params);

    const data = {
      alias: res.alias,
      address: res.data.smartAccountAddress,
      owner: res.data.ownerAlias,
      index: Number(res.data.index),
      kernelVersion: res.data.kernelVersion,
    };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

/**
 * Command that imports a smart account using JSON params only.
 */
export const importSmartAccountCommand = Command.make("import", {}, () =>
  handler(),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Import a smart account"),
  Command.withExamples([
    {
      command: `namera smart-account import --params '{"alias":"my-smart","ownerAlias":"my-owner","index":0,"kernelVersion":"0.3.2","smartAccountAddress":"0x1bC710cbA70f8Ce638dC5c8F50FDb05d87a7D652","entryPointVersion":"0.7","ownerType":"ecdsa"}'`,
      description: "Import a smart account with json params",
    },
    {
      command: "namera schema smart-account.import",
      description: "Get the schema for the smart account import command",
    },
  ]),
);
