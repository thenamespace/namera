import type { PrepareExecutionRequest } from "@namera-ai/protocol/dto";
import type { TypedDataDefinition } from "viem";

import type { LocalEvmSessionBinding } from "./execution-validation.js";

export type LocalSessionSigner = {
  readonly binding: LocalEvmSessionBinding;
  readonly maxGasCostWei?: bigint;
  /** Sign the 32 raw bytes with EIP-191. Never sign the UTF-8 hex string. */
  readonly signMessage: (message: { readonly raw: `0x${string}` }) => Promise<`0x${string}`>;
  readonly signTypedData?: (typedData: TypedDataDefinition) => Promise<`0x${string}`>;
};

/** Resolve from local storage; the API response is not an authority source. */
export type ResolveSessionSigner = (
  request: Pick<PrepareExecutionRequest, "namespace" | "walletId" | "sessionKeyId" | "chainId">,
) => Promise<LocalSessionSigner>;
