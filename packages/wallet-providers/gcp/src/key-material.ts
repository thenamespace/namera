import { createPublicKey } from "node:crypto";

import { Effect, Schema } from "effect";

import { Hex } from "@namera-ai/protocol";

import { GcpKeyError } from "#/errors";
import type { CreateKeyInput } from "#/schemas";

export const publicKeyHexFromPem = Effect.fnUntraced(function* (
  pem: string,
  algorithm: CreateKeyInput["algorithm"],
) {
  const jwk = yield* Effect.try({
    try: () => createPublicKey(pem).export({ format: "jwk" }),
    catch: (cause) => new GcpKeyError({ operation: "create", cause }),
  });

  if (jwk.x === undefined) {
    return yield* new GcpKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const x = Buffer.from(jwk.x, "base64url").toString("hex");
  if (algorithm === "ed25519") {
    return yield* Schema.decodeUnknownEffect(Hex)(`0x${x}`).pipe(
      Effect.mapError((cause) => new GcpKeyError({ operation: "create", cause })),
    );
  }

  if (jwk.y === undefined) {
    return yield* new GcpKeyError({
      operation: "create",
      cause: new Error("Public key coordinates are missing"),
    });
  }

  const value = `0x04${x}${Buffer.from(jwk.y, "base64url").toString("hex")}`;

  return yield* Schema.decodeUnknownEffect(Hex)(value).pipe(
    Effect.mapError((cause) => new GcpKeyError({ operation: "create", cause })),
  );
});
