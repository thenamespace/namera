import { Effect } from "effect";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import { queueExecution } from "./execution.js";
import { makeTestApiClient, setApiKey, setAuthToken, signIn, testEmail } from "./index.js";
import { createTestPasskeyWallet, localSessionRequest } from "./local-session.js";
import type { makeOwnerSessionTestFixture } from "./owner-session.js";

export const queueRecoveryExecution = Effect.fn("test.execution.queueRecovery")(function* (
  fixture: Pick<ReturnType<typeof makeOwnerSessionTestFixture>, "confirmOperation">,
  scenario: string,
) {
  const client = yield* makeTestApiClient;
  const owner = yield* signIn(client, testEmail(`${scenario}@example.com`));
  const wallet = yield* createTestPasskeyWallet(client, "Recovery wallet");
  const session = yield* client.sessionKey.create({
    payload: yield* localSessionRequest(wallet.id),
  });
  yield* fixture.confirmOperation(client, session, "install");

  const billingBefore = yield* client.billing.get();
  const apiKey = yield* client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Recovery agent" },
      durationDays: 7,
      sessionKeyIds: [session.id],
    },
  });
  yield* setAuthToken();
  yield* setApiKey(apiKey.key);

  const queued = yield* queueExecution(client, {
    headers: { "idempotency-key": scenario },
    payload: {
      namespace: "eip155",
      walletId: wallet.id,
      sessionKeyId: session.id,
      chainId: "eip155:1",
      calls: [{ to: wallet.address, value: 0n, data: "0x" }],
    },
  });

  return {
    client,
    owner,
    queued,
    organizationId: owner.actor.organization.id,
    billingBefore,
    app: yield* Application,
    repository: yield* Repository,
  };
});
