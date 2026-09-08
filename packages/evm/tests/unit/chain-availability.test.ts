import { Effect, Schema } from "effect";

import { EthereumAddress, EvmSessionAuthorization, Hex } from "@namera-ai/protocol";
import type { EvmSessionInstallationData } from "@namera-ai/protocol/model";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, expect, it, vi } from "vitest";

import { createWalletKeySecp256k1Account } from "../../src/accounts/secp256k1.js";
import type { ReconstructEvmAccountInput } from "../../src/accounts/types.js";
import { chains } from "../../src/chains/data.js";
import * as chainLookup from "../../src/chains/helpers.js";
import { makePrepareEvmExecution } from "../../src/execution/prepare.js";
import { makeReconstructPreparedAccount } from "../../src/execution/prepared-account.js";
import { makeTestEvmExecutionService } from "../../src/execution/test.js";
import { makeEvmSessionService } from "../../src/sessions/service.js";
import { makeEvmSessionSignatureService } from "../../src/signing/session.js";
import { makeEvmSignatureService } from "../../src/signing/sign.js";

afterEach(() => vi.restoreAllMocks());

it("rejects new operation boundaries on a paused chain before provider or signer access", async () => {
  const local = privateKeyToAccount(generatePrivateKey());
  const sign = vi.fn(async (): Promise<Uint8Array> => {
    throw new Error("Paused chain must not sign");
  });
  const account: ReconstructEvmAccountInput = {
    wallet: {
      version: 1,
      implementation: "alchemy-modular-v2",
      modularAccountVersion: "2.0.0",
      entryPointVersion: "0.7",
      validatorType: "ecdsa_secp256k1",
      accountMode: "7702",
      delegationVersion: "v1.0.0",
      address: EthereumAddress.make(local.address),
    },
    owner: {
      validatorType: "ecdsa_secp256k1",
      account: createWalletKeySecp256k1Account({ publicKey: local.publicKey, sign }),
    },
  };
  const chainId = "eip155:1";
  const paused = { ...chains["ethereum-mainnet"], operationsEnabled: false };
  vi.spyOn(chainLookup, "getChainDataByCaip2").mockReturnValue(paused);
  const getClients = vi.fn((): never => {
    throw new Error("Paused chain must not access providers");
  });
  const quote = vi.fn((): never => {
    throw new Error("Paused chain must not request a gas quote");
  });
  const execution = makeTestEvmExecutionService();
  const preparation = { account, chainId, calls: [], sponsorship: "none" } as const;
  const prepared = await Effect.runPromise(execution.prepare(preparation));
  const authorization = Schema.decodeUnknownSync(EvmSessionAuthorization)({
    version: 1,
    entityId: 1,
    signerAddress: local.address,
    validAfter: 0,
    validUntil: 3600,
    allowSignatures: true,
    permissions: [{ type: "root" }],
  });
  const session: EvmSessionInstallationData = {
    version: 1,
    authorization,
    moduleAddress: EthereumAddress.make(local.address),
    isGlobal: true,
    installCallData: Hex.make("0x"),
    uninstallCallData: Hex.make("0x"),
    hooks: [],
  };
  const signatureInput = { account, chainId, session, type: "message", message: "hello" } as const;
  const signatures = makeEvmSessionSignatureService(getClients);
  const operations: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
    makePrepareEvmExecution(getClients, quote)(preparation),
    makeReconstructPreparedAccount(getClients)({ account, prepared }),
    makeEvmSessionService(getClients, execution).compile({ account, chainId, authorization }),
    makeEvmSignatureService(getClients).sign(signatureInput),
    signatures.prepare(signatureInput),
    signatures.complete({ ...signatureInput, signature: Hex.make("0x") }),
  ];
  const failures = await Effect.runPromise(Effect.forEach(operations, Effect.flip));
  for (const failure of failures) {
    expect(failure).toMatchObject({
      _tag: "UnsupportedChainError",
      namespace: "eip155",
      chainId,
    });
  }
  expect(getClients).not.toHaveBeenCalled();
  expect(quote).not.toHaveBeenCalled();
  expect(sign).not.toHaveBeenCalled();
  // Pausing operations does not remove metadata needed by history and recovery.
  expect(chainLookup.getChainDataByChainId(1)?.chainId).toBe(chainId);
});
