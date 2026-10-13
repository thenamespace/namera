import { Effect } from "effect";

import { WalletTransactionError, type EvmPreparedExecution } from "@namera-ai/protocol";
import { entryPoint07Abi } from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";

export const makeCheckEvmFunding = (
  getClients: (chain: ChainData) => Pick<ExecutionClients, "publicClient">,
) =>
  Effect.fn("evm.execution.checkFunding")(function* (prepared: EvmPreparedExecution) {
    const chain = getChainDataByCaip2(prepared.chainId);
    if (!chain) return yield* new WalletTransactionError({ code: "PREPARATION_FAILED" });
    const { publicClient } = getClients(chain);
    const op = prepared.userOperation;
    const value = prepared.context.calls.reduce((total, call) => total + call.value, 0n);
    const gas =
      prepared.sponsorship === "none"
        ? (op.callGasLimit + op.verificationGasLimit + op.preVerificationGas) * op.maxFeePerGas
        : 0n;
    if (value === 0n && gas === 0n) return;
    const [balance, deposit] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          publicClient.getBalance({ address: op.sender, blockTag: "pending" }),
          prepared.sponsorship === "none"
            ? publicClient.readContract({
                address: prepared.entryPoint,
                abi: entryPoint07Abi,
                functionName: "balanceOf",
                args: [op.sender],
              })
            : Promise.resolve(0n),
        ]),
      catch: () => new WalletTransactionError({ code: "PREPARATION_FAILED" }),
    });
    // EntryPoint deposits pay gas, never the native value transferred by calls.
    if (balance < value || balance - value + deposit < gas)
      return yield* new WalletTransactionError({ code: "INSUFFICIENT_FUNDS" });
  });
