import { createPublicKey } from "node:crypto";

import { Effect, Schema } from "effect";

import { Hex, WalletKeyError } from "@namera-ai/protocol";

export const publicKeyHexFromPem = Effect.fn("WalletKeys.publicKeyHexFromPem")(function* (
  pem: string,
) {
  const jwk = yield* Effect.try({
    try: () => createPublicKey(pem).export({ format: "jwk" }),
    catch: (cause) => new WalletKeyError({ operation: "create", cause }),
  });

  if (jwk.x === undefined || jwk.y === undefined) {
    return yield* new WalletKeyError({
      operation: "create",
      cause: new Error("P-256 public key coordinates are missing"),
    });
  }

  const value = `0x04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}`;

  return yield* Schema.decodeUnknownEffect(Hex)(value).pipe(
    Effect.mapError((cause) => new WalletKeyError({ operation: "create", cause })),
  );
});
