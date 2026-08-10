import { Context } from "effect";
import type { Effect } from "effect";

import type { WalletKeyError } from "@namera-ai/protocol";

import type { CreatedWalletKey, CreateWalletKeyInput, SignWalletKeyInput } from "./data.js";

export interface WalletKeysService {
  readonly create: (input: CreateWalletKeyInput) => Effect.Effect<CreatedWalletKey, WalletKeyError>;
  readonly sign: (input: SignWalletKeyInput) => Effect.Effect<Uint8Array, WalletKeyError>;
}

export class WalletKeys extends Context.Service<WalletKeys, WalletKeysService>()(
  "@namera-ai/application/WalletKeys",
) {}
