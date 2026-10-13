import { Effect } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import type { WalletId } from "@namera-ai/protocol";
import type { PrepareWalletTransactionRequest } from "@namera-ai/protocol/dto";

export const makeHashWalletTransaction = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  return Effect.fnUntraced(function* (
    walletId: WalletId,
    request: PrepareWalletTransactionRequest,
  ) {
    return yield* crypto.hash({
      purpose: "wallet.transaction",
      value: JSON.stringify({
        walletId,
        namespace: request.namespace,
        chainId: request.chainId,
        calls: request.calls.map((call) => ({
          to: call.to.toLowerCase(),
          value: call.value.toString(),
          data: call.data.toLowerCase(),
        })),
        sponsor: request.sponsor ?? true,
      }),
    });
  });
});
