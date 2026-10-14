import { Context, Effect, Layer } from "effect";

import { GcpKeyError } from "#/errors";
import { makeGcpService } from "#/gcp";
import type {
  CreateKeyInput,
  CreatedKey,
  SignMessageInput,
  SignDigestInput,
  KeyReference,
} from "#/schemas";
import { makeTestGcp } from "#/testing";

export interface GcpOperations {
  readonly createKey: (input: CreateKeyInput) => Effect.Effect<CreatedKey, GcpKeyError>;
  readonly signMessage: (input: SignMessageInput) => Effect.Effect<Uint8Array, GcpKeyError>;
  readonly signDigest: (input: SignDigestInput) => Effect.Effect<Uint8Array, GcpKeyError>;
  readonly disableKey: (input: KeyReference) => Effect.Effect<void, GcpKeyError>;
  readonly destroyKey: (input: KeyReference) => Effect.Effect<void, GcpKeyError>;
}

export class GcpService extends Context.Service<GcpService, GcpOperations>()(
  "@namera-ai/wallet-provider-gcp/GcpService",
) {
  static readonly layer = Layer.effect(GcpService, makeGcpService);
  static readonly testLayer = Layer.succeed(GcpService, makeTestGcp());
  static readonly disabledLayer = Layer.succeed(GcpService, {
    createKey: Effect.fn("wallet-providers.gcp.disabled")(function* () {
      return yield* new GcpKeyError({
        operation: "create",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    signMessage: Effect.fn("wallet-providers.gcp.disabled")(function* () {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    signDigest: Effect.fn("wallet-providers.gcp.disabled")(function* () {
      return yield* new GcpKeyError({
        operation: "sign",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    disableKey: Effect.fn("wallet-providers.gcp.disabled")(function* () {
      return yield* new GcpKeyError({
        operation: "disable",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
    destroyKey: Effect.fn("wallet-providers.gcp.disabled")(function* () {
      return yield* new GcpKeyError({
        operation: "destroy",
        cause: new Error("Managed signing is disabled in this deployment"),
      });
    }),
  });
}
