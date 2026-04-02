import { Console, Effect, type Option, Redacted, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CreateSessionKeyParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import {
  OutputFormatter,
  PromptManager,
  SessionKeyManager,
  SmartAccountManager,
  Web3Service,
} from "@/layers";
import { getChain } from "@/schema";

import { getPoliciesFromUser } from "./prompts";

const handler = (
  flagAlias: Option.Option<string>,
  flagSmartAccountAlias: Option.Option<string>,
  flagSessionKeyPassword: Option.Option<Redacted.Redacted<string>>,
  flagOwnerKeystorePassword: Option.Option<Redacted.Redacted<string>>,
) =>
  Effect.gen(function* () {
    const promptManager = yield* PromptManager.PromptManager;
    const web3Service = yield* Web3Service.Web3Service;
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: CreateSessionKeyParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(CreateSessionKeyParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let smartAccountAlias: string;
      let sessionKeyPassword: Redacted.Redacted<string>;
      let ownerKeystorePassword: Redacted.Redacted<string>;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        alias = yield* promptManager.aliasPrompt({
          aliasType: "new",
          message: "Enter alias for session key:",
          type: "session-key",
        });
      }

      if (flagSmartAccountAlias._tag === "Some") {
        smartAccountAlias = flagSmartAccountAlias.value;
      } else {
        smartAccountAlias = (yield* smartAccountManager.selectSmartAccount({
          message: "Select smart account:",
        })).alias;
      }

      const chains = yield* web3Service.multiSelectChain({
        message: "Select chains:",
      });

      if (flagSessionKeyPassword._tag === "Some") {
        sessionKeyPassword = flagSessionKeyPassword.value;
      } else {
        sessionKeyPassword = yield* promptManager.passwordPrompt({
          message: "Enter session key password:",
        });
      }

      const sa = yield* smartAccountManager.getSmartAccount({
        alias: smartAccountAlias,
      });

      if (flagOwnerKeystorePassword._tag === "Some") {
        ownerKeystorePassword = flagOwnerKeystorePassword.value;
      } else {
        ownerKeystorePassword = yield* promptManager.passwordPrompt({
          message: `Enter keystore password for owner (${sa.data.ownerAlias}):`,
        });
      }

      const policyParams = yield* getPoliciesFromUser();

      params = {
        alias,
        chains,
        smartAccountAlias,
        sessionKeyPassword: Redacted.value(sessionKeyPassword),
        ownerKeystorePassword: Redacted.value(ownerKeystorePassword),
        policyParams,
      };
    }

    const res = yield* sessionKeyManager.createSessionKey(params);

    const data = {
      ...(res.data.sessionKeyType === "ecdsa"
        ? {
            sessionKeyAddress: res.data.sessionKeyAddress,
          }
        : {
            passKeyName: res.data.passKeyName,
          }),
      smartAccount: res.data.smartAccountAlias,
      chains: res.data.serializedAccounts.map((a) => getChain(a.chain).name),
    };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the session key to create"),
  Flag.withAlias("a"),
  Flag.optional,
);

const smartAccountAlias = Flag.string("smart-account").pipe(
  Flag.withDescription(
    "The alias of the smart account to create session key for",
  ),
  Flag.withAlias("sa"),
  Flag.optional,
);

const sessionKeyPassword = Flag.redacted("password").pipe(
  Flag.withDescription("Password to encrypt session key"),
  Flag.withAlias("p"),
  Flag.optional,
);

const ownerKeystorePassword = Flag.redacted("owner-password").pipe(
  Flag.withDescription("Password to encrypt session key"),
  Flag.withAlias("op"),
  Flag.optional,
);

/**
 * Command that creates a new session key and stores it locally.
 */
export const createSessionKeyCommand = Command.make(
  "create",
  { alias, smartAccountAlias, sessionKeyPassword, ownerKeystorePassword },
  ({ alias, smartAccountAlias, sessionKeyPassword, ownerKeystorePassword }) =>
    handler(
      alias,
      smartAccountAlias,
      sessionKeyPassword,
      ownerKeystorePassword,
    ),
).pipe(
  Command.withAlias("c"),
  Command.withDescription("Creates a new session key"),
  Command.withExamples([
    {
      command: "namera session-key create",
      description: "Creates a new session key with interactive prompts",
    },
    {
      command: "namera schema session-key.create",
      description: "Get the schema for session key create command",
    },
  ]),
);
