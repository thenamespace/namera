import { Duration, Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { TestEvmExecution } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import { setApiKey, setAuthToken } from "./index.js";
import { prepareCustodyOperation, setupSessionCustody } from "./session-custody.js";

export const setupManagedOperations = Effect.fn("test.setupManagedOperations")(function* (
  owner: "passkey" | "1claw",
  options: Parameters<typeof setupSessionCustody>[2] = {
    allowSignatures: true,
    policies: [{ type: "evm.signature", version: 1, allowedTypes: ["message", "typed-data"] }],
  },
) {
  const fixture = yield* setupSessionCustody(owner, "1claw", options);
  const installation = fixture.session.installations[0];
  if (!installation) return yield* Effect.die("Missing installation");
  const operation = yield* prepareCustodyOperation(fixture.client, owner, {
    installationId: installation.id,
    kind: "install",
    sponsor: false,
    idempotencyKey: crypto.randomUUID(),
  });
  yield* operation.approve;
  yield* (yield* TestEvmExecution).setReceiptMode("immediate");
  yield* TestClock.adjust(Duration.seconds(2));
  const app = yield* Application;
  yield* app.sessionKey.reconcileOperations();
  const apiKey = yield* fixture.client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Managed operations" },
      durationDays: 1,
      sessionKeyIds: [fixture.session.id],
    },
  });
  yield* setAuthToken();
  yield* setApiKey(apiKey.key);
  yield* Ref.set(fixture.control.calls, []);
  const scope = {
    namespace: "eip155" as const,
    walletId: fixture.wallet.id,
    sessionKeyId: fixture.session.id,
    chainId: installation.chainId,
  };
  return {
    ...fixture,
    app,
    apiKey,
    executionRequest: {
      headers: { "idempotency-key": crypto.randomUUID() },
      payload: {
        ...scope,
        calls: [{ to: fixture.wallet.address, value: 0n, data: Hex.make("0x") }],
        sponsor: false,
      },
    },
    signatureRequest: {
      headers: { "idempotency-key": crypto.randomUUID() },
      payload: {
        ...scope,
        type: "message" as const,
        message: "Namera managed session test",
      },
    },
  };
});
