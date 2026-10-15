import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigProvider, Effect, Layer } from "effect";

import { LocalService } from "../../src/index.js";

export const localLayer = (directory: string) =>
  Layer.fresh(LocalService.layer).pipe(
    Layer.provide(
      ConfigProvider.layer(ConfigProvider.fromUnknown({ WALLET_KEYS_LOCAL_DIRECTORY: directory })),
    ),
  );

export const withLocalService = <A, E>(
  run: (directory: string) => Effect.Effect<A, E, LocalService>,
) =>
  Effect.acquireUseRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), "namera-wallet-keys-"))),
    (directory) => run(directory).pipe(Effect.provide(localLayer(directory))),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  );

export const readPrivateKey = (directory: string, fileName: string) =>
  Effect.promise(async () => {
    const encoded = await readFile(join(directory, fileName), "utf8");
    return (JSON.parse(encoded) as { readonly privateKeyPem: string }).privateKeyPem;
  });
