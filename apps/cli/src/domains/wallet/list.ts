import { Console, Effect, Result } from "effect";
import { Command } from "effect/unstable/cli";

import { AliasManager, ConfigManager } from "@/layers";

export const listWalletsHandler = () =>
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;
    const aliasManager = yield* AliasManager;

    const { idToAlias } = yield* aliasManager.getAliasFile("keystore");
    const walletsIdentifiers = yield* configManager.getEntitiesForType({
      type: "keystore",
    });

    const results = yield* Effect.all(
      walletsIdentifiers.map((identifier) =>
        Effect.gen(function* () {
          const content = yield* configManager.getEntity({
            identifier,
            type: "keystore",
          });

          const keystore = JSON.parse(content) as { address?: string };

          return {
            address: keystore.address,
            alias: idToAlias.get(identifier),
            identifier,
          };
        }),
      ),
      { concurrency: "unbounded", mode: "result" },
    );

    for (const res of results) {
      if (Result.isSuccess(res)) {
        const { address, alias } = res.success;
        yield* Console.log(
          `${alias} ${address ? `(0x${address})` : ""} (Local)`,
        );
      }
    }
  });

export const listWalletsCommand = Command.make("list", {}, () =>
  listWalletsHandler(),
).pipe(Command.withDescription("List all Locally stored wallets."));
