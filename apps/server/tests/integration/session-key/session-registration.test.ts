import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { makeTestEvmSessionService } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";

layer(makeTestServerLayer({ sessions: makeTestEvmSessionService() }))(
  "local session registration",
  (it) => {
    it.effect(
      "persists a local signer and pending installations without granting execution authority",
      () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const owner = yield* signIn(client, testEmail("local-session-registration@namera.test"));
          const { request, session: created } = yield* registerPendingLocalSession(client);
          expect(created.status).toBe("pending");
          expect(created.installations).toHaveLength(2);
          expect(created.installations.every(({ status }) => status === "pending")).toBe(true);
          expect(created.installations.map(({ chainId }) => chainId).toSorted()).toEqual(
            request.onchain.chains.toSorted(),
          );
          const repository = yield* Repository;
          expect(
            yield* repository.core.signingKey.findById(
              created.signingKeyId,
              owner.actor.organization.id,
            ),
          ).toMatchObject({
            purpose: "session",
            custody: "local",
            algorithm: "secp256k1",
            publicKeyHex: request.signer.publicKey,
            data: { version: 1, type: "local-key" },
          });
          expect(
            yield* repository.core.sessionKey.activate(created.id, owner.actor.organization.id),
          ).toBeUndefined();
          expect(
            yield* client.sessionKey.create({ payload: request }).pipe(Effect.flip),
          ).toMatchObject({ code: "SIGNER_ALREADY_REGISTERED" });
          expect(
            yield* client.apiKey
              .create({
                payload: {
                  metadata: { version: 1, name: "Premature grant" },
                  durationDays: 1,
                  sessionKeyIds: [created.id],
                },
              })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "ApiKeyCreationError" });
          expect(
            (yield* repository.audit.organization.findForOrganization(
              owner.actor.organization.id,
            )).some(
              ({ event, resourceId }) =>
                event === "session_key.created" && resourceId === created.id,
            ),
          ).toBe(true);
          expect(
            yield* client.sessionKey
              .create({
                payload: {
                  ...request,
                  signer: { ...request.signer, publicKey: Hex.make(`0x04${"00".repeat(64)}`) },
                },
              })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "LOCAL_SIGNER_INVALID" });
          yield* TestClock.adjust(Duration.seconds(2));
          expect(
            yield* client.sessionKey
              .create({
                payload: {
                  ...request,
                  onchain: { ...request.onchain, validAfter: 0, validUntil: 1 },
                },
              })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "TIME_WINDOW_EXPIRED" });
          expect(yield* client.sessionKey.listForOrganization()).toHaveLength(1);
        }),
    );
  },
);
