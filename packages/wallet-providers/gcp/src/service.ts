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
const unavailable = Effect.fn("wallet-providers.gcp.disabled")(function* (
  operation: GcpKeyError["operation"],
) {
  return yield* new GcpKeyError({
    operation,
    cause: new Error("Managed signing is disabled in this deployment"),
  });
});

export class GcpService extends Context.Service<GcpService, GcpOperations>()(
  "@namera-ai/wallet-provider-gcp/GcpService",
) {
  static readonly layer = Layer.effect(GcpService, makeGcpService);
  static readonly testLayer = Layer.succeed(GcpService, makeTestGcp());
  static readonly disabledLayer = Layer.succeed(GcpService, {
    createKey: () => unavailable("create"),
    signMessage: () => unavailable("sign"),
    signDigest: () => unavailable("sign"),
    disableKey: () => unavailable("disable"),
    destroyKey: () => unavailable("destroy"),
  });
}
