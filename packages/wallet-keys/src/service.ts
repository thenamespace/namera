import { Context, Layer, type Effect } from "effect";

import type { WalletKeyError } from "@namera-ai/protocol";
import type {
  CreatedWalletKey,
  CreateWalletKeyInput,
  DestroyWalletKeyInput,
  DisableWalletKeyInput,
  SignWalletKeyHashInput,
  SignWalletKeyMessageInput,
} from "@namera-ai/protocol/model";

import { makeGcpWalletKeys } from "./gcp.js";
import { makeLocalWalletKeys } from "./local.js";
import { makeTestWalletKeys } from "./test.js";

export interface WalletKeysService {
  readonly create: (input: CreateWalletKeyInput) => Effect.Effect<CreatedWalletKey, WalletKeyError>;
  readonly signMessage: (
    input: SignWalletKeyMessageInput,
  ) => Effect.Effect<Uint8Array, WalletKeyError>;
  readonly signHash: (input: SignWalletKeyHashInput) => Effect.Effect<Uint8Array, WalletKeyError>;
  readonly disable: (input: DisableWalletKeyInput) => Effect.Effect<void, WalletKeyError>;
  readonly destroy: (input: DestroyWalletKeyInput) => Effect.Effect<void, WalletKeyError>;
}

// Consumers persist only provider-neutral key metadata and call this service
// for lifecycle operations. Private material never crosses this boundary: it
// remains in local development storage or the configured Cloud KMS provider.
export class WalletKeys extends Context.Service<WalletKeys, WalletKeysService>()(
  "@namera-ai/wallet-keys/WalletKeys",
) {
  static readonly layer = Layer.effect(WalletKeys, makeGcpWalletKeys);

  static readonly devLayer = Layer.effect(WalletKeys, makeLocalWalletKeys);

  static readonly testLayer = Layer.succeed(WalletKeys, makeTestWalletKeys());
}
