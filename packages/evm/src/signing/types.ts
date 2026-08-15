import type { Effect } from "effect";

import type {
  EvmSignatureError,
  EvmTypedData,
  Hex,
  SupportedEvmChainId,
  UnsupportedChainError,
} from "@namera-ai/protocol";

import type { ReconstructEvmAccountInput } from "../accounts/types.js";

type SignEvmInputCommon = {
  readonly chainId: SupportedEvmChainId;
  readonly account: ReconstructEvmAccountInput;
};

export type SignEvmInput = SignEvmInputCommon &
  (
    | { readonly type: "message"; readonly message: string }
    | { readonly type: "typed-data"; readonly typedData: EvmTypedData }
  );

export type SignEvm = (
  input: SignEvmInput,
) => Effect.Effect<Hex, EvmSignatureError | UnsupportedChainError>;

export interface EvmSignatureService {
  readonly sign: SignEvm;
}
