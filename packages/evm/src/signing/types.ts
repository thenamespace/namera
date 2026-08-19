import type { Effect } from "effect";

import type {
  Bytes32,
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

export type VerifyEvmInput = SignEvmInputCommon &
  (
    | { readonly type: "message"; readonly message: string; readonly signature: Hex }
    | {
        readonly type: "typed-data";
        readonly typedData: EvmTypedData;
        readonly signature: Hex;
      }
  );

export type VerifyEvm = (
  input: VerifyEvmInput,
) => Effect.Effect<boolean, EvmSignatureError | UnsupportedChainError>;

export type DigestEvmSignature = (
  input:
    | { readonly type: "message"; readonly message: string }
    | { readonly type: "typed-data"; readonly typedData: EvmTypedData },
) => Effect.Effect<Bytes32, EvmSignatureError>;

export interface EvmSignatureService {
  readonly digest: DigestEvmSignature;
  readonly sign: SignEvm;
  readonly verify: VerifyEvm;
}
