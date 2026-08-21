import { Effect, Option, Schema } from "effect";

import {
  EvmExecutionError,
  EvmExecutionReceipt,
  EvmUserOperationStatus,
  TransactionHash,
  UnsupportedChainError,
} from "@namera-ai/protocol";
import type { UserOperationReceipt } from "viem/account-abstraction";
import {
  UserOperationReceiptNotFoundError,
  WaitForUserOperationReceiptTimeoutError,
} from "viem/account-abstraction";

import type { ChainData } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { ExecutionClients } from "../clients/execution.js";
import type { GetEvmExecutionReceiptInput, WaitForEvmExecutionReceiptInput } from "./types.js";

const AlchemyUserOperationStatus = Schema.Struct({
  status: Schema.Literals(["unknown", "pending", "pendingBundle", "mined", "preconfirmed"]),
  receipt: Schema.NullOr(
    Schema.Struct({
      success: Schema.Boolean,
      receipt: Schema.Struct({ transactionHash: TransactionHash }),
    }),
  ),
});

const normalizeReceipt = Effect.fn("evm.execution.normalizeReceipt")(function* (
  chainId: GetEvmExecutionReceiptInput["chainId"],
  receipt: UserOperationReceipt,
) {
  return yield* Schema.decodeUnknownEffect(EvmExecutionReceipt)({
    version: 1,
    namespace: "eip155",
    chainId,
    userOperationHash: receipt.userOpHash,
    transactionHash: receipt.receipt.transactionHash,
    blockHash: receipt.receipt.blockHash,
    blockNumber: receipt.receipt.blockNumber.toString(),
    sender: receipt.sender,
    nonce: BigInt(receipt.nonce).toString(),
    entryPoint: receipt.entryPoint,
    paymaster: receipt.paymaster ?? null,
    actualGasCost: receipt.actualGasCost.toString(),
    actualGasUsed: receipt.actualGasUsed.toString(),
    success: receipt.success,
    reason: receipt.success ? null : (receipt.reason ?? null),
  }).pipe(
    Effect.mapError((cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause })),
  );
});

export const makeGetEvmExecutionReceipt = (getClients: (chain: ChainData) => ExecutionClients) =>
  Effect.fn("evm.execution.getReceipt")(function* (input: GetEvmExecutionReceiptInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const receipt = yield* Effect.tryPromise({
      try: async () => {
        try {
          return Option.some(
            await getClients(chain).bundlerClient.getUserOperationReceipt({
              hash: input.userOperationHash,
            }),
          );
        } catch (cause) {
          if (cause instanceof UserOperationReceiptNotFoundError) return Option.none();
          throw cause;
        }
      },
      catch: (cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause }),
    });

    if (Option.isNone(receipt)) return Option.none();

    const normalized = yield* normalizeReceipt(input.chainId, receipt.value);
    if (normalized.userOperationHash.toLowerCase() !== input.userOperationHash.toLowerCase()) {
      return yield* new EvmExecutionError({
        code: "RECEIPT_LOOKUP_FAILED",
        cause: new Error("The bundler returned a receipt for a different UserOperation"),
      });
    }

    return Option.some(normalized);
  });

export const makeGetEvmUserOperationStatus = (getClients: (chain: ChainData) => ExecutionClients) =>
  Effect.fn("evm.execution.getStatus")(function* (input: GetEvmExecutionReceiptInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const response = yield* Effect.tryPromise({
      try: () =>
        getClients(chain).statusClient.request({
          method: "rundler_getUserOperationStatus",
          params: [input.userOperationHash],
        }),
      catch: (cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause }),
    });
    const status = yield* Schema.decodeUnknownEffect(AlchemyUserOperationStatus)(response).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause })),
    );
    const normalized = (() => {
      if (status.status === "unknown") {
        return { status: "not_found", transactionHash: null } as const;
      }
      if (status.status === "pending" || status.status === "pendingBundle") {
        return { status: "submitted", transactionHash: null } as const;
      }
      if (status.receipt === null) {
        return { status: "submitted", transactionHash: null } as const;
      }
      return {
        status: status.receipt.success ? ("included" as const) : ("failed" as const),
        transactionHash: status.receipt.receipt.transactionHash,
      };
    })();

    return yield* Schema.decodeUnknownEffect(EvmUserOperationStatus)(normalized).pipe(
      Effect.mapError((cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause })),
    );
  });

export const makeWaitForEvmExecutionReceipt = (
  getClients: (chain: ChainData) => ExecutionClients,
) =>
  Effect.fn("evm.execution.waitForReceipt")(function* (input: WaitForEvmExecutionReceiptInput) {
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) {
      return yield* new UnsupportedChainError({
        namespace: "eip155",
        chainId: input.chainId,
      });
    }

    const receipt = yield* Effect.tryPromise({
      try: async () => {
        try {
          return Option.some(
            await getClients(chain).bundlerClient.waitForUserOperationReceipt({
              hash: input.userOperationHash,
              timeout: Math.min(Math.max(input.timeoutMilliseconds ?? 30_000, 1), 120_000),
            }),
          );
        } catch (cause) {
          if (cause instanceof WaitForUserOperationReceiptTimeoutError) return Option.none();
          throw cause;
        }
      },
      catch: (cause) => new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause }),
    });

    if (Option.isNone(receipt)) return Option.none();

    const normalized = yield* normalizeReceipt(input.chainId, receipt.value);
    if (normalized.userOperationHash.toLowerCase() !== input.userOperationHash.toLowerCase()) {
      return yield* new EvmExecutionError({
        code: "RECEIPT_LOOKUP_FAILED",
        cause: new Error("The bundler returned a receipt for a different UserOperation"),
      });
    }

    return Option.some(normalized);
  });
