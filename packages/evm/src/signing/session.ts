import { Effect, Schema } from "effect";

import {
  DefaultModuleAddress,
  pack1271Signature,
  toReplaySafeTypedData,
} from "@alchemy/smart-accounts";
import { EvmSignatureError, EvmTypedData, Hex, UnsupportedChainError } from "@namera-ai/protocol";
import { concatHex, isAddressEqual, verifyTypedData, type TypedDataDefinition } from "viem";

import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { digestEvmSignature } from "./digest.js";
import type { EvmSessionSignatureService, SignEvmSessionInput } from "./types.js";

/** Public-key-only adapter. Callers own tenant/grant checks, expiry and billing. */
export const makeEvmSessionSignatureService = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
): EvmSessionSignatureService => {
  const resolve = Effect.fn("evm.signature.resolveSession")(function* (input: SignEvmSessionInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain !== undefined && !chain.operationsEnabled) {
      return yield* new EvmSignatureError({
        code: "NETWORK_PAUSED",
        cause: new Error("New operations on this network are paused"),
      });
    }
    if (chain === undefined)
      return yield* new UnsupportedChainError({ namespace: "eip155", chainId: input.chainId });

    if (
      input.session.authorization.allowSignatures !== true ||
      !isAddressEqual(input.session.moduleAddress, DefaultModuleAddress.SINGLE_SIGNER_VALIDATION)
    ) {
      return yield* new EvmSignatureError({
        code: "SIGNING_FAILED",
        cause: new Error("Session has no supported onchain signature authority"),
      });
    }
    const { publicClient } = getClients(chain);
    const account = yield* reconstructEvmAccount(input.account, publicClient).pipe(
      Effect.mapError(
        (cause) =>
          new EvmSignatureError({
            code:
              cause.code === "ACCOUNT_ADDRESS_MISMATCH"
                ? "ACCOUNT_ADDRESS_MISMATCH"
                : "ACCOUNT_RECONSTRUCTION_FAILED",
            cause,
          }),
      ),
    );
    const hash = yield* digestEvmSignature(input);
    const typedData = yield* Schema.decodeUnknownEffect(EvmTypedData)(
      toReplaySafeTypedData({
        address: input.session.moduleAddress,
        chainId: chain.chain.id,
        hash,
        // Session validators use the module domain and a wallet-specific salt,
        // unlike the root account validator's replay-safe domain.
        salt: concatHex([`0x${"00".repeat(12)}`, account.address]),
      }),
    ).pipe(Effect.mapError((cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause })));
    return { account, publicClient, hash, typedData };
  });

  return {
    prepare: Effect.fn("evm.signature.prepareSession")(function* (input) {
      return (yield* resolve(input)).typedData;
    }),
    complete: Effect.fn("evm.signature.completeSession")(function* (input) {
      const { account, publicClient, hash, typedData } = yield* resolve(input);
      const valid = yield* Effect.tryPromise({
        try: () =>
          verifyTypedData({
            ...(typedData as unknown as TypedDataDefinition),
            address: input.session.authorization.signerAddress,
            signature: input.signature,
          }),
        catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
      });
      if (!valid)
        return yield* new EvmSignatureError({
          code: "SIGNING_FAILED",
          cause: new Error("Signature does not match the session signer and payload"),
        });

      const signature = Hex.make(
        pack1271Signature({
          entityId: input.session.authorization.entityId,
          validationSignaturePrefix: "0x00",
          validationSignature: input.signature,
        }),
      );
      // ECDSA recovery alone cannot establish active smart-account authority.
      // This also rejects uninstalled, revoked, or incorrectly routed validators.
      const accepted = yield* Effect.tryPromise({
        try: () => publicClient.verifyHash({ address: account.address, hash, signature }),
        catch: (cause) => new EvmSignatureError({ code: "VERIFICATION_FAILED", cause }),
      });
      if (!accepted)
        return yield* new EvmSignatureError({
          code: "VERIFICATION_FAILED",
          cause: new Error("Account rejected the session signature"),
        });
      return signature;
    }),
  };
};
