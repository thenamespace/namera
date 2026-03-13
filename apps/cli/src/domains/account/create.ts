import { getKernelAddressFromECDSA } from "@namera-ai/core";
import { Console, Effect, Option } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import type { SelectChoice } from "effect/unstable/cli/Prompt";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

import {
  AccountManager,
  AliasManager,
  ConfigManager,
  KeystoreManager,
} from "@/layers";
import type { LocalSmartAccount } from "@/schema";

const createAccountHandler = (
  ownerAlias: Option.Option<string>,
  index: Option.Option<number>,
  _alias: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const aliasManager = yield* AliasManager;
    const keystoreManager = yield* KeystoreManager;
    const accountManager = yield* AccountManager;
    const configManager = yield* ConfigManager;

    // Alias Prompt
    const aliasPrompt = Prompt.text({
      message: "Enter alias:",
      validate: (value) =>
        Effect.gen(function* () {
          yield* aliasManager
            .ensureUniqueAlias({
              alias: value,
              type: "account",
            })
            .pipe(
              Effect.catchTag("AliasError", () =>
                Effect.fail("Alias already exists"),
              ),
            );

          return value;
        }),
    });

    let alias: string;
    if (Option.isSome(_alias)) {
      yield* aliasManager.ensureUniqueAlias({
        alias: _alias.value,
        type: "account",
      });
      alias = _alias.value;
    } else {
      alias = yield* aliasPrompt;
    }

    const keystores = yield* keystoreManager.listKeystores();
    let identifier: string;

    const identifierPrompt = Prompt.select({
      choices: keystores
        // biome-ignore lint/suspicious/useIterableCallbackReturn: safe
        .map((v) => {
          if (v._op === "Failure") return;
          const { alias, keystore, identifier } = v.success;
          const { address } = keystore;
          return {
            title: `${alias ? alias : ""} ${address ? `(0x${address})` : ""} ${
              !alias ? identifier : ""
            }(Local)`,
            value: v.success.identifier,
          };
        })
        .filter(Boolean) as SelectChoice<string>[],
      message: "Select a owner wallet for this smart account",
    });

    if (Option.isSome(ownerAlias)) {
      const id = yield* aliasManager.getIdentifier({
        alias: ownerAlias.value,
        type: "keystore",
      });

      if (id) identifier = id;
      else identifier = yield* identifierPrompt;
    } else {
      identifier = yield* identifierPrompt;
    }

    const keystore = yield* keystoreManager.getKeystore({
      identifier,
    });

    const accountIndex = Option.isSome(index) ? BigInt(index.value) : BigInt(0);

    const client = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    const smartAccountAddress = yield* Effect.promise(() => {
      return getKernelAddressFromECDSA({
        client,
        entrypointVersion: "0.7",
        eoaAddress: keystore.keystore.address,
        index: accountIndex,
        kernelVersion: "0.3.2",
      });
    });

    const data: LocalSmartAccount = {
      chainId: sepolia.id,
      entrypointVersion: "0.7",
      index: Number(accountIndex),
      kernelVersion: "0.3.2",
      ownerIdentifier: identifier,
      ownerType: "ecdsa",
      smartAccountAddress,
    };

    const entityPath = yield* configManager.getEntityPath({
      identifier: smartAccountAddress,
      type: "account",
    });

    yield* accountManager.storeAccount(alias, data);

    yield* Console.log(
      "\n✅ Successfully created Smart Account.",
      `\nAlias: ${alias}`,
      `\nAddress: ${smartAccountAddress}`,
      `\nPath: ${entityPath}`,
    );
  });

const index = Flag.integer("index").pipe(
  Flag.optional,
  Flag.withDescription("The index of the account (default: 0)"),
  Flag.withAlias("i"),
);

const owner = Flag.string("owner").pipe(
  Flag.withDescription("The owner alias for the account"),
  Flag.withAlias("o"),
  Flag.optional,
);

const alias = Flag.string("alias").pipe(
  Flag.withDescription("Alias for the smart account"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const createAccountCommand = Command.make(
  "create",
  { alias, index, owner },
  ({ index, owner, alias }) => createAccountHandler(owner, index, alias),
).pipe(
  Command.withDescription("Creates a new smart account for specified owner"),
  Command.withAlias("c"),
  Command.withExamples([
    {
      command: "namera account create",
      description: "Creates a new smart account user selected alias and owner",
    },
    {
      command: "namera account create -o my-account",
      description:
        "Creates a new smart account with owner account alias 'my-account'",
    },
    {
      command: "namera account create -a my-account",
      description: "Creates a new smart account with alias 'my-account'",
    },
    {
      command: "namera account create -i 2",
      description: "Creates a new smart account with index 2",
    },
  ]),
);
