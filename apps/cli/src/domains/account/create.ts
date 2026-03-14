import { getKernelAddressFromECDSA } from "@namera-ai/core";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
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
  existingAlias: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const aliasManager = yield* AliasManager;
    const keystoreManager = yield* KeystoreManager;
    const accountManager = yield* AccountManager;
    const configManager = yield* ConfigManager;

    // Alias Prompt
    const alias = yield* aliasManager.selectAlias({
      existingAlias,
      message: "Enter alias:",
      type: "account",
    });

    const keystore = yield* keystoreManager.selectKeystore({
      alias: ownerAlias,
      message: "Select the owner wallet for this smart account",
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
      ownerIdentifier: keystore.identifier,
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
