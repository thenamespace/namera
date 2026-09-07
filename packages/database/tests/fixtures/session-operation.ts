import { DateTime, Effect, Schema } from "effect";

import {
  EvmPreparedExecution,
  Hex,
  UserOperationHash,
  type EvmSignedExecution,
} from "@namera-ai/protocol";
import type { SessionKeyOperationInsert } from "@namera-ai/protocol/model";

import { Repository } from "../../src/index.js";
import { installationFixture } from "./session-installation.js";

export const sessionOperationFixture = Effect.fn("test.sessionOperation.fixture")(function* (
  name: string,
) {
  const owner = yield* installationFixture(name);
  const installation = yield* (yield* Repository).core.sessionKeyInstallation.insert(owner.input);
  const gas = {
    callGasLimit: "100000",
    verificationGasLimit: "100000",
    preVerificationGas: "0",
    maxFeePerGas: "0",
    maxPriorityFeePerGas: "0",
  };
  const calls = [{ to: owner.wallet.data.address, value: "0", data: "0xab" }];
  const prepared = Schema.decodeUnknownSync(Schema.toCodecJson(EvmPreparedExecution))({
    version: 1,
    namespace: "eip155",
    chainId: installation.chainId,
    entryPointVersion: "0.7",
    entryPoint: owner.wallet.data.address,
    sponsorship: "none",
    userOperation: {
      sender: owner.wallet.data.address,
      nonce: "0",
      callData: "0xab",
      signature: "0x",
      ...gas,
    },
    billing: { executionMeter: "execution.testnet", sponsorship: null },
    context: {
      version: 1,
      namespace: "eip155",
      chainId: installation.chainId,
      account: owner.wallet.data.address,
      block: { number: "1", hash: `0x${"0".repeat(64)}`, timestamp: "2026-09-01T00:00:00.000Z" },
      calls,
      userOperation: {
        nonce: "0",
        paymaster: null,
        gas: { ...gas, paymasterVerificationGasLimit: "0", paymasterPostOpGasLimit: "0" },
      },
      simulation: {
        userOperation: { source: "eth_estimateUserOperationGas", ...gas },
        calls: { source: "viem.simulateCalls", results: [], assetChanges: [], transfers: [] },
      },
    },
  });
  const { context: _context, ...envelope } = prepared;
  const signed: EvmSignedExecution = {
    ...envelope,
    userOperation: { ...prepared.userOperation, signature: Hex.make("0x1234") },
    userOperationHash: UserOperationHash.make(`0x${"11".repeat(32)}`),
  };
  const input: SessionKeyOperationInsert = {
    organizationId: owner.organization.id,
    actorId: owner.actor.id,
    installationId: installation.id,
    walletId: owner.wallet.id,
    chainId: installation.chainId,
    kind: "install",
    idempotencyKey: name,
    requestHash: name,
    data: { version: 1, prepared, signed: null },
    expiresAt: DateTime.fromEpochSeconds(100),
  };
  return { ...owner, installation, input, signed };
});
