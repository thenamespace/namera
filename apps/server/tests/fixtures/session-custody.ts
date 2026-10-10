import { Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { Hex } from "@namera-ai/protocol";
import type {
  PrepareSessionKeyOperationRequest,
  CreateSessionKeyRequest,
} from "@namera-ai/protocol/dto";
import { OneClawTestControl } from "@namera-ai/wallet-provider-oneclaw";

import type { TestApiClient } from "./api.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "./index.js";
import { createTestPasskeyWallet, localSessionRequest } from "./local-session.js";
import { managedSessionLayer } from "./managed-session.js";

const authenticator = createTestAuthenticator();
const execution = makeTestEvmExecutionService({}, { verifySessionSignature: true });
export const makeSessionCustodyLayer = (
  delay?: "10 seconds" | "3 minutes",
  onVerification: Effect.Effect<void> = Effect.void,
) => {
  const sessionExecution = makeTestEvmExecutionService(
    {},
    {
      verifySessionSignature: true,
      onSessionVerification: onVerification,
      ...(delay === undefined ? {} : { sessionVerificationDelay: delay }),
    },
  );
  return managedSessionLayer(
    {
      ownerApprovalChallenge: () => Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
      completeOwnerApproval: execution.sign,
      completeSessionExecution: sessionExecution.completeSessionExecution,
    },
    authenticator.layer,
    { onVerification, ...(delay === undefined ? {} : { verificationDelay: delay }) },
  );
};
export const sessionCustodyLayer = makeSessionCustodyLayer();

export const setupSessionCustody = Effect.fn("test.setupSessionCustody")(function* (
  owner: "passkey" | "1claw",
  custody: "local" | "1claw",
  options: {
    readonly allowSignatures?: boolean;
    readonly policies?: CreateSessionKeyRequest["policies"];
  } = {},
) {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  yield* Ref.set(control.failNext, undefined);
  const client = yield* makeTestApiClient;
  const actor = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
  const wallet = yield* owner === "passkey"
    ? createTestPasskeyWallet(client)
    : client.wallet.create({
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", provider: "1claw" },
          metadata: { version: 1, name: "Managed parent" },
        },
      });
  const local = yield* localSessionRequest(wallet.id, ["eip155:11155111", "eip155:84532"]);
  const session = yield* client.sessionKey.create({
    payload: {
      ...local,
      onchain: { ...local.onchain, allowSignatures: options.allowSignatures ?? false },
      policies: options.policies ?? local.policies,
      signer:
        custody === "local"
          ? local.signer
          : { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
    },
  });
  yield* Ref.set(control.calls, []);
  return {
    client,
    actor,
    organizationId: actor.actor.organization.id,
    wallet,
    session,
    control,
    repository: yield* Repository,
  };
});

/** Approval depends only on the parent; the session signer is deliberately absent. */
export const prepareCustodyOperation = Effect.fn("test.prepareCustodyOperation")(function* (
  client: TestApiClient,
  owner: "passkey" | "1claw",
  payload: PrepareSessionKeyOperationRequest,
) {
  if (owner === "1claw") {
    const prepared = yield* client.sessionKey.prepareManagedOperation({ payload });
    return {
      prepared,
      approve: client.sessionKey.approveManagedOperation({
        payload: { operationId: prepared.operationId },
      }),
    };
  }
  const prepared = yield* client.sessionKey.prepareOperation({ payload });
  return {
    prepared,
    approve: client.sessionKey.completeOperation({
      payload: {
        operationId: prepared.operationId,
        response: authenticator.authenticate({
          challenge: prepared.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 0,
        }),
      },
    }),
  };
});
