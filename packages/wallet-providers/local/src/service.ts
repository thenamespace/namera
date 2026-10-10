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
const unavailable = Effect.fn("wallet-providers.local.disabled")(function* (
  operation: LocalKeyError["operation"],
) {
  return yield* new LocalKeyError({
    operation,
    cause: new Error("Managed signing is disabled in this deployment"),
  });
});

export class LocalService extends Context.Service<LocalService, LocalOperations>()(
  "@namera-ai/wallet-provider-local/LocalService",
) {
  static readonly layer = Layer.effect(LocalService, makeLocalService);
  static readonly testLayer = Layer.succeed(LocalService, makeTestLocal());
  static readonly disabledLayer = Layer.succeed(LocalService, {
    createKey: () => unavailable("create"),
    signMessage: () => unavailable("sign"),
    signDigest: () => unavailable("sign"),
    disableKey: () => unavailable("disable"),
    destroyKey: () => unavailable("destroy"),
  });
}
