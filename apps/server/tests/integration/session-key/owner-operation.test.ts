import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { makeTestEvmSessionService } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";

layer(
  makeTestServerLayer({
    sessions: makeTestEvmSessionService(),
    execution: {
      ownerApprovalChallenge: () => Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
    },
  }),
)("owner operation preparation", (it) => {
  it.effect(
    "persists the exact operation and makes retries stable without duplicate owner nonces",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("owner-operation@namera.test"));
        const { session } = yield* registerPendingLocalSession(client);
        const installation = session.installations[0];
        if (installation === undefined) return yield* Effect.die("Missing fixture installation");
        const payload = {
          installationId: installation.id,
          kind: "install" as const,
          idempotencyKey: crypto.randomUUID(),
          sponsor: false,
        };
        const prepared = yield* client.sessionKey.prepareOperation({ payload });
        expect(
          yield* client.sessionKey.getOperation({
            params: { operationId: prepared.operationId },
          }),
        ).toEqual({ operationId: prepared.operationId, status: "awaiting-signature" });
        expect(prepared.options).toMatchObject({
          rpId: "dashboard.test",
          userVerification: "required",
          allowCredentials: [{ id: "test-passkey", type: "public-key" }],
        });
        expect(prepared.options.challenge).toBe(Buffer.alloc(32, 0x11).toString("base64url"));
        const replay = yield* client.sessionKey.prepareOperation({ payload });
        expect(replay.operationId).toBe(prepared.operationId);
        expect(replay.prepared).toEqual(prepared.prepared);
        expect(
          yield* client.sessionKey
            .prepareOperation({ payload: { ...payload, sponsor: true } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        expect(
          yield* client.sessionKey
            .prepareOperation({ payload: { ...payload, idempotencyKey: crypto.randomUUID() } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "OPERATION_BUSY" });
        const repository = yield* Repository;
        const stored = yield* repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId: owner.actor.organization.id,
        });
        expect(stored?.status).toBe("awaiting-signature");
        expect(stored?.data.signed).toBeNull();
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).filter(({ event }) => event === "session_key.operation_prepared"),
        ).toHaveLength(1);
        yield* TestClock.adjust(Duration.minutes(6));
        expect(
          yield* client.sessionKey.prepareOperation({ payload }).pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_EXPIRED" });
        yield* signIn(client, testEmail("other-owner-operation@namera.test"));
        expect(
          yield* client.sessionKey
            .getOperation({
              params: { operationId: prepared.operationId },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      }),
  );
});
