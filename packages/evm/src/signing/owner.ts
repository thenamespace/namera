import { Effect, Schema } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

import { Bytes32, EvmSignatureError, Hex, UnsupportedChainError } from "@namera-ai/protocol";
import {
  hashTypedData,
  hexToBytes,
  isErc6492Signature,
  serializeErc6492Signature,
  type TypedDataDefinition,
} from "viem";

import { packErc1271Signature, replaySafeTypedData } from "../accounts/alchemy-modular-v2.js";
import {
  encodeVerifiedOwnerAssertion,
  type VerifiedOwnerAssertion,
} from "../accounts/passkey-signature.js";
import { reconstructEvmAccount } from "../accounts/reconstruct.js";
import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import { digestEvmSignature } from "./digest.js";
import type { SignEvmInput } from "./types.js";

const ClientData = Schema.fromJsonString(
  Schema.Struct({ type: Schema.Literal("webauthn.get"), challenge: Schema.String }),
);

export const makeEvmOwnerSignatureService = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
) => {
  const resolve = Effect.fnUntraced(function* (input: SignEvmInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (!chain)
      return yield* new UnsupportedChainError({ namespace: "eip155", chainId: input.chainId });
    if (!chain.operationsEnabled)
      return yield* new EvmSignatureError({
        code: "NETWORK_PAUSED",
        cause: new Error("Network paused"),
      });
    const client = getClients(chain).publicClient;
    const account = yield* reconstructEvmAccount(input.account, client).pipe(
      Effect.mapError((cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause })),
    );
    const digest = yield* digestEvmSignature(input);
    const challenge =
      input.account.owner.validatorType === "webauthn_p256"
        ? Bytes32.make(
            hashTypedData(
              replaySafeTypedData({
                accountAddress: account.address,
                chainId: chain.chain.id,
                hash: digest,
              }),
            ),
          )
        : null;
    return { account, challenge };
  });
  return {
    prepare: Effect.fn("evm.ownerSignatures.prepare")(function* (input: SignEvmInput) {
      return (yield* resolve(input)).challenge;
    }),
    complete: Effect.fn("evm.ownerSignatures.complete")(function* (
      input: SignEvmInput & { readonly assertion?: VerifiedOwnerAssertion },
    ) {
      const { account, challenge } = yield* resolve(input);
      const signature = yield* Effect.gen(function* () {
        if (input.account.wallet.validatorType === "webauthn_p256") {
          if (!input.assertion || !challenge)
            return yield* new EvmSignatureError({
              code: "SIGNING_FAILED",
              cause: new Error("Missing verified assertion"),
            });
          const clientData = yield* Schema.decodeUnknownEffect(ClientData)(
            input.assertion.clientDataJSON,
          ).pipe(
            Effect.mapError((cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause })),
          );
          if (clientData.challenge !== Base64Url.encode(hexToBytes(challenge)))
            return yield* new EvmSignatureError({
              code: "SIGNING_FAILED",
              cause: new Error("Assertion payload mismatch"),
            });
          const assertion = input.assertion;
          const entityId = input.account.wallet.entityId;
          return yield* Effect.try({
            try: () => packErc1271Signature(entityId, encodeVerifiedOwnerAssertion(assertion)),
            catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
          });
        }
        if (input.assertion)
          return yield* new EvmSignatureError({
            code: "SIGNING_FAILED",
            cause: new Error("Unexpected assertion"),
          });
        return yield* Effect.tryPromise({
          try: () =>
            input.type === "message"
              ? account.signMessage({ message: input.message })
              : account.signTypedData(input.typedData as unknown as TypedDataDefinition),
          catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
        });
      });
      // External verifiers need the deployment envelope, not just the root signature.
      return yield* Effect.tryPromise({
        try: async () => {
          if (isErc6492Signature(signature)) return Hex.make(signature);
          const { factory, factoryData } = await account.getFactoryArgs();
          return Hex.make(
            factory && factoryData
              ? serializeErc6492Signature({ address: factory, data: factoryData, signature })
              : signature,
          );
        },
        catch: (cause) => new EvmSignatureError({ code: "SIGNING_FAILED", cause }),
      });
    }),
  };
};

export type EvmOwnerSignatureService = ReturnType<typeof makeEvmOwnerSignatureService>;
