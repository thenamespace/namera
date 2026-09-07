import { Effect, Schema } from "effect";

import { EthereumAddress, EvmExecutionError, Hex } from "@namera-ai/protocol";
import * as Secp256k1 from "ox/Secp256k1";
import { publicKeyToAddress } from "viem/accounts";

/** Accept a public curve point, never private signing material. */
export const resolveEvmSessionSigner = Effect.fn("evm.sessions.resolveSigner")((publicKey: Hex) =>
  Effect.try({
    try: () => {
      const point = Secp256k1.noble.ProjectivePoint.fromHex(publicKey.slice(2));
      point.assertValidity();
      const normalized = `0x${point.toHex(false)}` as const;
      return {
        publicKey: Hex.make(normalized),
        address: Schema.decodeSync(EthereumAddress)(publicKeyToAddress(normalized)),
      };
    },
    catch: (cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
  }),
);
