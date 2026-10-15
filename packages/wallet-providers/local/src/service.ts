import { Context, Effect, Layer } from "effect";

import { LocalKeyError } from "#/errors";
import { makeLocalService } from "#/local";
import type {
  CreateKeyInput,
  CreatedKey,
  SignMessageInput,
  SignDigestInput,
  KeyReference,
} from "#/schemas";
import { makeTestLocal } from "#/testing";

export interface LocalOperations {
  readonly createKey: (input: CreateKeyInput) => Effect.Effect<CreatedKey, LocalKeyError>;
  readonly signMessage: (input: SignMessageInput) => Effect.Effect<Uint8Array, LocalKeyError>;
  readonly signDigest: (input: SignDigestInput) => Effect.Effect<Uint8Array, LocalKeyError>;
  readonly disableKey: (input: KeyReference) => Effect.Effect<void, LocalKeyError>;
  readonly destroyKey: (input: KeyReference) => Effect.Effect<void, LocalKeyError>;
}

export class LocalService extends Context.Service<LocalService, LocalOperations>()(
  "@namera-ai/wallet-provider-local/LocalService",
) {
  static readonly layer = Layer.effect(LocalService, makeLocalService);
  static readonly testLayer = Layer.succeed(LocalService, makeTestLocal());
  static readonly disabledLayer = Layer.succeed(LocalService, {
    createKey: Effect.fn("wallet-providers.local.disabled")(function* () {
      return yield* new LocalKeyError({
        operation: "create",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    signMessage: Effect.fn("wallet-providers.local.disabled")(function* () {
      return yield* new LocalKeyError({
        operation: "sign",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    signDigest: Effect.fn("wallet-providers.local.disabled")(function* () {
      return yield* new LocalKeyError({
        operation: "sign",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    disableKey: Effect.fn("wallet-providers.local.disabled")(function* () {
      return yield* new LocalKeyError({
        operation: "disable",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    destroyKey: Effect.fn("wallet-providers.local.disabled")(function* () {
      return yield* new LocalKeyError({
        operation: "destroy",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
  });
}
