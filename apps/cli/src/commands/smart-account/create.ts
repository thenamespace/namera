import { Console, Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CreateSmartAccountParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import {
  KeystoreManager,
  OutputFormatter,
  PromptManager,
  SmartAccountManager,
} from "@/layers";

const handler = (
  flagAlias: Option.Option<string>,
  flagOwnerAlias: Option.Option<string>,
  flagOwnerPassword: Option.Option<Redacted.Redacted<string>>,
  flagIndex: Option.Option<number>,
) =>
  Effect.gen(function* () {
    const promptManager = yield* PromptManager.PromptManager;
    const keystoreManager = yield* KeystoreManager.KeystoreManager;
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: CreateSmartAccountParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(CreateSmartAccountParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let ownerAlias: string;
      let ownerPassword: Redacted.Redacted<string>;
      let index: bigint;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        alias = yield* promptManager.aliasPrompt({
          aliasType: "new",
          message: "Enter alias for smart account:",
          type: "smart-account",
        });
      }

      if (flagOwnerAlias._tag === "Some") {
        ownerAlias = flagOwnerAlias.value;
      } else {
        ownerAlias = (yield* keystoreManager.selectKeystore({
          message: "Select owner keystore:",
        })).alias;
      }

      if (flagOwnerPassword._tag === "Some") {
        ownerPassword = flagOwnerPassword.value;
      } else {
        ownerPassword = yield* keystoreManager.getKeystorePassword({
          alias: ownerAlias,
          message: `Enter password for owner (${ownerAlias}):`,
        });
      }

      if (flagIndex._tag === "Some") {
        index = BigInt(flagIndex.value);
      } else {
        index = 0n;
      }

      params = {
        alias,
        ownerAlias,
        index,
        ownerPassword: Redacted.value(ownerPassword),
      };
    }

    const res = yield* smartAccountManager.createSmartAccount(params);

    const data = {
      address: res.data.smartAccountAddress,
      kernelVersion: res.data.kernelVersion,
      index: Number(res.data.index),
      owner: res.data.ownerAlias,
    };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the smart account to create"),
  Flag.withAlias("a"),
  Flag.optional,
);

const ownerAlias = Flag.string("owner-alias").pipe(
  Flag.withDescription("The alias of the owner keystore"),
  Flag.withAlias("oa"),
  Flag.optional,
);

const ownerPassword = Flag.redacted("owner-password").pipe(
  Flag.withDescription("The password of the owner keystore"),
  Flag.withAlias("op"),
  Flag.optional,
);

const index = Flag.integer("index").pipe(
  Flag.withDescription("The index of the smart account"),
  Flag.withAlias("i"),
  Flag.optional,
);

/**
 * Command that creates a new smart account and stores it locally.
 *
 * Accepts alias, owner alias, and index via flags or JSON params.
 */
export const createSmartAccountCommand = Command.make(
  "create",
  { alias, ownerAlias, ownerPassword, index },
  ({ alias, ownerAlias, ownerPassword, index }) =>
    handler(alias, ownerAlias, ownerPassword, index),
).pipe(
  Command.withAlias("c"),
  Command.withDescription("Creates a new smart account"),
  Command.withExamples([
    {
      command: "namera smart-account create",
      description: "Creates a new smart account with interactive prompts",
    },
    {
      command:
        "namera smart-account create --alias my-smart --owner-alias my-owner --index 0",
      description:
        "Creates a new smart account with alias 'my-smart', owner alias 'my-owner', and index 0",
    },
    {
      command: `namera smart-account create --params '{"alias":"my-smart","owner-alias":"my-owner","index":0}'`,
      description: "Creates a new smart account with json params",
    },
    {
      command: "namera schema smart-account.create",
      description: "Get the schema for the create command",
    },
  ]),
);
