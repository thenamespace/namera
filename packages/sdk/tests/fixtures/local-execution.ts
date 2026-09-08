import { DateTime, Schema } from "effect";

import { encodeCallsMAv2 } from "@alchemy/smart-accounts";
import { PrepareExecutionRequest, PrepareExecutionResponse } from "@namera-ai/protocol/dto";
import { Bytes32, EthereumAddress } from "@namera-ai/protocol/evm";
import { entryPoint07Address, getUserOperationHash } from "viem/account-abstraction";

import type { LocalEvmSessionBinding } from "../../src/signing/execution-validation.js";

export const localExecutionFixture = () => {
  const request = Schema.decodeUnknownSync(PrepareExecutionRequest)({
    namespace: "eip155",
    walletId: "01950000-0000-7000-8000-000000000001",
    sessionKeyId: "01950000-0000-7000-8000-000000000002",
    chainId: "eip155:11155111",
    calls: [{ to: `0x${"11".repeat(20)}`, value: "123", data: "0x" }],
  });
  const gas = {
    callGasLimit: "100000",
    verificationGasLimit: "200000",
    preVerificationGas: "0",
    maxFeePerGas: "0",
    maxPriorityFeePerGas: "0",
  };
  const address = `0x${"33".repeat(20)}`;
  const nonce = (7n << 72n) | (1n << 64n);
  const decoded = Schema.decodeUnknownSync(PrepareExecutionResponse)({
    namespace: "eip155",
    submissionId: "01950000-0000-7000-8000-000000000003",
    sessionKeyId: request.sessionKeyId,
    installationId: "01950000-0000-7000-8000-000000000004",
    signingKeyId: "01950000-0000-7000-8000-000000000005",
    signing: { method: "personal_sign", message: `0x${"00".repeat(32)}` },
    expiresAt: new Date("2026-09-08T12:05:00Z"),
    prepared: {
      version: 1,
      namespace: "eip155",
      chainId: request.chainId,
      entryPoint: entryPoint07Address,
      entryPointVersion: "0.7",
      sponsorship: "alchemy-bso",
      billing: { executionMeter: "execution.testnet", sponsorship: null },
      userOperation: {
        sender: address,
        nonce: String(nonce),
        callData: encodeCallsMAv2(request.calls),
        ...gas,
        signature: "0x",
      },
      context: {
        version: 1,
        namespace: "eip155",
        chainId: request.chainId,
        account: address,
        block: {
          number: "123",
          hash: `0x${"44".repeat(32)}`,
          timestamp: new Date("2026-09-08T12:00:00Z"),
        },
        calls: Schema.encodeSync(PrepareExecutionRequest)(request).calls,
        userOperation: {
          nonce: String(nonce),
          paymaster: null,
          gas: { ...gas, paymasterVerificationGasLimit: "0", paymasterPostOpGasLimit: "0" },
        },
        simulation: {
          userOperation: { source: "eth_estimateUserOperationGas", ...gas },
          calls: {
            source: "viem.simulateCalls",
            results: [{ status: "success", returnData: "0x", gasUsed: "100" }],
            assetChanges: [],
            transfers: [],
          },
        },
      },
    },
  });
  const binding: LocalEvmSessionBinding = {
    walletId: request.walletId,
    walletAddress: decoded.prepared.userOperation.sender,
    sessionKeyId: request.sessionKeyId,
    signingKeyId: decoded.signingKeyId,
    installationId: decoded.installationId,
    chainId: request.chainId,
    signerAddress: EthereumAddress.make(`0x${"55".repeat(20)}`),
    entityId: 7,
    isGlobal: true,
    hasExecutionHooks: false,
    validAfter: DateTime.makeUnsafe("2026-09-08T11:00:00Z"),
    validUntil: DateTime.makeUnsafe("2026-09-08T13:00:00Z"),
  };
  const hash = getUserOperationHash({
    userOperation: decoded.prepared.userOperation,
    entryPointAddress: entryPoint07Address,
    entryPointVersion: "0.7",
    chainId: 11155111,
  });
  const response: PrepareExecutionResponse = {
    ...decoded,
    signing: { method: "personal_sign", message: Bytes32.make(hash) },
  };
  return { request, binding, response, now: DateTime.makeUnsafe("2026-09-08T12:01:00Z") };
};
