import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { makeTestEvmSessionSignatureService } from "@namera-ai/evm";
import { Hex, type SupportedEvmChainId } from "@namera-ai/protocol";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture(
  { sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)) },
  { sessionSignatures: makeTestEvmSessionSignatureService() },
);

layer(fixture.layer)("per-chain installed authority", (it) => {
  it.effect("isolates signature flags and validity windows after owner approval", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("per-chain-authority@namera.test"));
      const wallet = yield* createTestPasskeyWallet(client);
      const request = yield* localSessionRequest(wallet.id);
      const root = [{ type: "root" as const }];
      const pending = yield* client.sessionKey.create({
        payload: {
          ...request,
          onchain: {
            installations: [
              {
                chainId: "eip155:1",
                validAfter: 0,
                validUntil: 60,
                permissions: root,
                allowSignatures: false,
              },
              {
                chainId: "eip155:8453",
                validAfter: 60,
                validUntil: 3600,
                permissions: root,
                allowSignatures: true,
              },
              {
                chainId: "eip155:42161",
                validAfter: 0,
                validUntil: 3600,
                permissions: root,
                allowSignatures: true,
              },
            ],
          },
          policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message"] }],
        },
      });
      const session = yield* fixture.confirmOperation(client, pending, "install");
      expect(session.installations.every(({ status }) => status === "installed")).toBe(true);
      const grant = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Per-chain grant" },
          durationDays: 1,
          sessionKeyIds: [session.id],
        },
      });
      yield* setAuthToken();
      yield* setApiKey(grant.key);
      const prepareSignature = (chainId: SupportedEvmChainId) =>
        client.signature.prepare({
          headers: { "idempotency-key": crypto.randomUUID() },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId,
            type: "message",
            message: "Per-chain test",
          },
        });
      expect(yield* prepareSignature("eip155:1").pipe(Effect.flip)).toMatchObject({
        code: "SIGNATURE_UNAVAILABLE",
      });
      expect(yield* prepareSignature("eip155:8453").pipe(Effect.flip)).toMatchObject({
        code: "SIGNATURE_UNAVAILABLE",
      });
      expect(yield* prepareSignature("eip155:42161")).toHaveProperty("operationId");
      yield* TestClock.adjust(Duration.seconds(61));
      expect(yield* prepareSignature("eip155:8453")).toHaveProperty("operationId");
      const prepareExecution = (chainId: SupportedEvmChainId) =>
        client.execution.prepare({
          headers: { "idempotency-key": crypto.randomUUID() },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId,
            sponsor: false,
            calls: [{ to: wallet.address, data: Hex.make("0x"), value: 0n }],
          },
        });
      expect(yield* prepareExecution("eip155:1").pipe(Effect.flip)).toMatchObject({
        code: "EXECUTION_UNAVAILABLE",
      });
      expect(yield* prepareExecution("eip155:8453")).toHaveProperty("submissionId");
    }),
  );
});
