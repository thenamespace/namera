import { createPublicKey } from "node:crypto";

import { Effect, Schema } from "effect";

import { Hex, WalletKeyError } from "@namera-ai/protocol";
import type { WalletKey } from "@namera-ai/protocol/model";

export const publicKeyHexFromPem = Effect.fn("WalletKeys.publicKeyHexFromPem")(function* (
  pem: string,
  algorithm: WalletKey["algorithm"],
) {
  const jwk = yield* Effect.try({
    try: () => createPublicKey(pem).export({ format: "jwk" }),
    catch: (cause) => new WalletKeyError({ operation: "create", cause }),
  });

  if (jwk.x === undefined) {
    return yield* new WalletKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const x = Buffer.from(jwk.x, "base64url").toString("hex");
  if (algorithm === "ed25519") {
    return yield* Schema.decodeUnknownEffect(Hex)(`0x${x}`).pipe(
      Effect.mapError((cause) => new WalletKeyError({ operation: "create", cause })),
    );
  }

  if (jwk.y === undefined) {
    return yield* new WalletKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const value = `0x04${x}${Buffer.from(jwk.y, "base64url").toString("hex")}`;

  return yield* Schema.decodeUnknownEffect(Hex)(value).pipe(
    Effect.mapError((cause) => new WalletKeyError({ operation: "create", cause })),
  );
});
