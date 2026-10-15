import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Redacted, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository } from "@namera-ai/database";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

for (const scenario of ["lease-loss", "credential-save-failure"] as const) {
  const live = makeTestServerLayer(
    {},
    undefined,
    makeTestConfigLayer({
      ONECLAW_PLATFORM_APP_ID: "test-app",
      ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
    }),
    undefined,
    Layer.unwrap(
      Effect.gen(function* () {
        const repository = yield* Repository;
        return oneClawAccountTestLayer(
          scenario === "lease-loss"
            ? {
                connections: {
                  bootstrapEmpty: ({ connection }) =>
                    Effect.gen(function* () {
                      if (connection.externalConnectionId === null)
                        return yield* Effect.die("Expected reconciled connection");
                      // Disabling the connection revokes its lease while bootstrap is in flight.
                      yield* repository.core.providerConnections
                        .disable({ id: connection.id, organizationId: connection.organizationId })
                        .pipe(Effect.orDie);
                      return {
                        connectionId: connection.externalConnectionId,
                        token: Redacted.make("synthetic-claim"),
                        expiresAt: DateTime.add(yield* DateTime.now, { minutes: 10 }),
                      };
                    }),
                },
              }
            : {},
        );
      }),
    ),
  );

  layer(live)(`1Claw recovery boundary: ${scenario}`, (it) => {
    it.effect("stops before further provisioning or local account creation", () =>
      Effect.gen(function* () {
        yield* resetTestState();
        yield* TestClock.setTime(Date.now());
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`recovery-${scenario}@example.com`));
        const db = yield* Database;
        const repository = yield* Repository;
        const control = yield* OneClawTestControl;
        yield* Ref.set(control.calls, []);
        const request = {
          payload: {
            namespace: "eip155" as const,
            owner: { type: "namera-managed" as const, provider: "1claw" as const },
            metadata: { version: 1 as const, name: "Recovery boundary" },
          },
        };
        const verify = Effect.gen(function* () {
          expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
            _tag: "WalletCreationError",
          });
          expect(yield* client.wallet.list()).toEqual([]);
          expect(yield* db.query.signingKey.findMany()).toEqual([]);
          const calls = yield* Ref.get(control.calls);
          expect(calls).not.toContain("signingKeys.create");
          const events = yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          );
          expect(
            events.filter(
              ({ event }) => event === "wallet.created" || event === "signing_key.created",
            ),
          ).toEqual([]);
          if (scenario === "lease-loss") {
            expect(calls).not.toContain("agents.create");
            const connection = yield* repository.core.providerConnections.findByOrganization(
              owner.actor.organization.id,
              "test-app",
            );
            expect(connection?.data.bootstrapAttemptedAt).toBeDefined();
            expect(connection?.data.bootstrapCompletedAt).toBeNull();
            expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
              code: "PROVIDER_SETUP_FAILED",
            });
            expect(
              (yield* Ref.get(control.calls)).filter(
                (call) => call === "connections.bootstrapEmpty",
              ),
            ).toHaveLength(1);
          } else {
            expect(calls.filter((call) => call === "agents.create")).toHaveLength(1);
            expect(
              (yield* db.query.credentials.findMany()).filter(({ type }) => type === "1claw-agent"),
            ).toEqual([]);
            expect(
              events.filter(
                ({ event, data }) =>
                  event === "provider_credential.saved" && data.type === "1claw-agent",
              ),
            ).toEqual([]);
          }
        });
        if (scenario === "credential-save-failure") {
          yield* db.execute(
            "ALTER TABLE core.credentials ADD CONSTRAINT phase9_reject_agent CHECK (type <> '1claw-agent') NOT VALID",
          );
          yield* verify.pipe(
            Effect.ensuring(
              db
                .execute("ALTER TABLE core.credentials DROP CONSTRAINT phase9_reject_agent")
                .pipe(Effect.orDie),
            ),
          );
          const calls = yield* Ref.get(control.calls);
          expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
            code: "PROVIDER_RECOVERY_REQUIRED",
          });
          expect(yield* Ref.get(control.calls)).toEqual(calls);
          expect((yield* db.query.signerProvisioning.findMany())[0]).toMatchObject({
            status: "recovery_required",
            stage: "agent_create_started",
          });
        } else yield* verify;
      }),
    );
  });
}
