import { Effect, Schema } from "effect";

import { Hex, WalletKeyError } from "@namera-ai/protocol";

import type { WalletKeysService } from "./service.js";

export const makeTestWalletKeys = (): WalletKeysService => ({
  create: Effect.fn("wallet-keys.test.create")(function* (input) {
    if (input.provider === "1claw") {
      return yield* new WalletKeyError({
        operation: "create",
        code: "UNSUPPORTED_OPERATION",
        cause: new Error("The test provider does not implement 1Claw provisioning"),
      });
    }
    const keySeed = input.id.replaceAll("-", "").repeat(4).slice(0, 128);
    return {
      provider: "local",
      algorithm: input.algorithm,
      protectionLevel: input.protectionLevel,
      publicKeyHex: Schema.decodeSync(Hex)(
        input.algorithm === "ed25519" ? `0x${keySeed.slice(0, 64)}` : `0x04${keySeed}`,
      ),
      data: { version: 1, fileName: `${input.id}.json` },
    } as const;
  }),
  signMessage: Effect.fn("wallet-keys.test.signMessage")((input) =>
    Effect.succeed(
      input.algorithm === "ed25519"
        ? new Uint8Array(64)
        : new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1]),
    ),
  ),
  signHash: Effect.fn("wallet-keys.test.signHash")(function* (input) {
    if (input.provider === "1claw") {
      return yield* new WalletKeyError({
        operation: "sign",
        code: "UNSUPPORTED_OPERATION",
        cause: new Error("1Claw signing is not implemented"),
      });
    }
    return new Uint8Array([48, 6, 2, 1, 1, 2, 1, 1]);
  }),
  disable: Effect.fn("wallet-keys.test.disable")(function* (input) {
    if (input.provider === "1claw") {
      return yield* new WalletKeyError({
        operation: "disable",
        code: "UNSUPPORTED_OPERATION",
        cause: new Error("1Claw disablement is not implemented"),
      });
    }
  }),
  destroy: Effect.fn("wallet-keys.test.destroy")(() => Effect.succeed(undefined)),
});
