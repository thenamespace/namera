import { expect, layer } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();

layer(fixture.layer)("onchain session revocation", (it) => {
  it.effect(
    "cancels unsigned installation and completes revocation without pretending it was installed",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("unsigned-revocation@namera.test"));
        const { session } = yield* registerPendingLocalSession(client);
        const installation = session.installations[0];
        if (installation === undefined) return yield* Effect.die("Missing installation");
        const prepared = yield* client.sessionKey.prepareOperation({
          payload: {
            installationId: installation.id,
            kind: "install",
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        const revoked = yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
        expect(revoked.status).toBe("revoked");
        expect(
          (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoked");
        const repository = yield* Repository;
        expect(
          (yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }))?.status,
        ).toBe("expired");
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).filter(({ event }) => event === "session_key.revoked"),
        ).toHaveLength(1);
        expect(
          yield* client.sessionKey
            .completeOperation({
              payload: {
                operationId: prepared.operationId,
                response: fixture.authenticator.authenticate({
                  challenge: prepared.options.challenge,
                  origin: "http://dashboard.test",
                  rpId: "dashboard.test",
                }),
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_EXPIRED" });
      }),
  );

  it.effect("keeps a signed installation recoverable without restoring revoked API access", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("signed-revocation@namera.test"));
      const { session } = yield* registerPendingLocalSession(client);
      const installation = session.installations[0];
      if (installation === undefined) return yield* Effect.die("Missing installation");
      const prepared = yield* client.sessionKey.prepareOperation({
        payload: {
          installationId: installation.id,
          kind: "install",
          sponsor: false,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      yield* client.sessionKey.completeOperation({
        payload: {
          operationId: prepared.operationId,
          response: fixture.authenticator.authenticate({
            challenge: prepared.options.challenge,
            origin: "http://dashboard.test",
            rpId: "dashboard.test",
            counter: 1,
          }),
        },
      });
      expect(
        (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
      ).toBe("revoking");
      const provider = yield* TestEvmExecution;
      yield* provider.setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.seconds(2));
      const app = yield* Application;
      yield* app.sessionKey.reconcileOperations();
      const updated = yield* client.sessionKey.get({ params: { sessionKeyId: session.id } });
      expect(updated.status).toBe("revoking");
      expect(updated.installations.find(({ id }) => id === installation.id)?.status).toBe(
        "installed",
      );
      expect(
        yield* client.apiKey
          .create({
            payload: {
              metadata: { version: 1, name: "Cannot regain authority" },
              durationDays: 1,
              sessionKeyIds: [session.id],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "SESSION_KEY_NOT_ACTIVE" });
      expect(
        (yield* client.notification.list({ query: {} })).items.filter(
          ({ notification }) => notification.type === "session_key.revoked",
        ),
      ).toHaveLength(0);
    }),
  );

  it.effect(
    "revokes grants immediately but waits for successful onchain uninstall before notification",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("installed-revocation@namera.test"));
        const { session } = yield* registerPendingLocalSession(client);
        const installation = session.installations[0];
        if (installation === undefined) return yield* Effect.die("Missing installation");
        const approve = Effect.fnUntraced(function* (
          kind: "install" | "uninstall",
          counter: number,
        ) {
          const prepared = yield* client.sessionKey.prepareOperation({
            payload: {
              installationId: installation.id,
              kind,
              sponsor: false,
              idempotencyKey: crypto.randomUUID(),
            },
          });
          yield* client.sessionKey.completeOperation({
            payload: {
              operationId: prepared.operationId,
              response: fixture.authenticator.authenticate({
                challenge: prepared.options.challenge,
                origin: "http://dashboard.test",
                rpId: "dashboard.test",
                counter,
              }),
            },
          });
          yield* TestClock.adjust(Duration.seconds(2));
          return prepared;
        });
        const app = yield* Application;
        const provider = yield* TestEvmExecution;
        yield* provider.setReceiptMode("immediate");
        yield* approve("install", 1);
        yield* app.sessionKey.reconcileOperations();
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Revoked agent" },
            durationDays: 1,
            sessionKeyIds: [session.id],
          },
        });
        expect(
          (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoking");
        const repository = yield* Repository;
        expect(
          yield* repository.core.sessionKeyGrant.findActiveForActor(
            owner.actor.organization.id,
            apiKey.apiKey.actorId,
          ),
        ).toHaveLength(0);
        expect(
          (yield* client.notification.list({ query: {} })).items.filter(
            ({ notification }) => notification.type === "session_key.revoked",
          ),
        ).toHaveLength(0);
        yield* approve("uninstall", 2);
        yield* provider.setReceiptMode("failed");
        yield* app.sessionKey.reconcileOperations();
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoking");
        yield* approve("uninstall", 3);
        yield* provider.setReceiptMode("immediate");
        yield* app.sessionKey.reconcileOperations();
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoked");
        const events = yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(
          events.filter(({ event }) => event === "session_key.revocation_requested"),
        ).toHaveLength(1);
        expect(events.filter(({ event }) => event === "session_key.revoked")).toHaveLength(1);
        expect(events.find(({ event }) => event === "session_key.revoked")?.data).toMatchObject({
          revokedGrantCount: 1,
        });
        expect(
          (yield* client.notification.list({ query: {} })).items.filter(
            ({ notification }) => notification.type === "session_key.revoked",
          ),
        ).toHaveLength(1);
      }),
  );
});
