import { describe, expect, layer } from "@effect/vitest";
import { Effect, Result } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";
import { Passkeys } from "@namera-ai/passkeys";
import { createTestRegistration } from "@namera-ai/passkeys/testing";

import type { TestApiClient } from "../../fixtures/api.js";
import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const prepareWallet = Effect.fn("test.prepareIndependentWallet")(function* (client: TestApiClient) {
  const registration = yield* client.wallet.createPasskeyRegistrationOptions();
  const attestation = createTestRegistration({
    challenge: registration.options.challenge,
    origin: "http://dashboard.test",
    rpId: "dashboard.test",
  });
  return {
    payload: {
      namespace: "eip155" as const,
      metadata: { version: 1 as const, name: "Independent passkey" },
      owner: {
        type: "passkey" as const,
        verificationId: registration.verificationId,
        response: attestation.response,
      },
    },
  };
});

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "independent wallet admission on PostgreSQL",
  () => {
    layer(makeTestServerLayer({}, Passkeys.layer))((it) => {
      it.effect(
        "admits one of five users with distinct verified registrations at the last slot",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const owner = yield* signIn(client, testEmail("independent-wallet-owner@example.com"));
            const organizationId = owner.actor.organization.id;
            const clients = [
              yield* handledApi(NameraApi, {
                headers: { cookie: `auth-token=${owner.cookie.value}` },
              }),
            ];
            for (let index = 0; index < 4; index++) {
              yield* setAuthToken(owner.cookie.value);
              const member = yield* createMember(
                client,
                testEmail(`independent-wallet-${index}@example.com`),
                "admin",
              );
              clients.push(
                yield* handledApi(NameraApi, {
                  headers: { cookie: `auth-token=${member.memberToken}` },
                }),
              );
            }
            const ownerClient = clients[0];
            if (!ownerClient) return yield* Effect.die("Missing owner client");
            const actors = yield* Effect.forEach(clients, (actorClient) =>
              actorClient.session.currentUser(),
            );
            expect(new Set(actors.map((actor) => actor.user.id)).size).toBe(5);
            expect(actors.every((actor) => actor.organization.id === organizationId)).toBe(true);

            const template = yield* ownerClient.wallet.create(yield* prepareWallet(ownerClient));
            const repository = yield* Repository;
            const stored = yield* repository.core.wallet.findById(template.id, organizationId);
            if (!stored) return yield* Effect.die("Missing capacity wallet");
            // Seed occupancy only. Every competing admission uses real HTTP and WebAuthn verification.
            for (let index = 1; index < 9; index++) {
              yield* repository.core.wallet.insert({
                organizationId,
                signingKeyId: template.owner.signingKeyId,
                createdByActorId: stored.wallet.createdByActorId,
                namespace: template.namespace,
                metadata: template.metadata,
                data: stored.wallet.data,
                status: "active",
              });
            }
            const requests = yield* Effect.forEach(clients, (actorClient) =>
              prepareWallet(actorClient),
            );
            expect(new Set(requests.map(({ payload }) => payload.owner.verificationId)).size).toBe(
              5,
            );
            expect(new Set(requests.map(({ payload }) => payload.owner.response.id)).size).toBe(5);
            const outcomes = yield* Effect.forEach(
              clients,
              (actorClient, index) => {
                const request = requests[index];
                if (!request) return Effect.die("Missing registration");
                return actorClient.wallet.create(request).pipe(Effect.result);
              },
              { concurrency: 5 },
            );
            expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
            const failures = outcomes.filter(Result.isFailure);
            expect(failures).toHaveLength(4);
            for (const failure of failures) {
              expect(failure.failure).toMatchObject({
                code: "LIMIT_EXCEEDED",
                limit: "localWallets",
              });
            }
            expect(
              (yield* ownerClient.billing.get()).resources.find(
                ({ key }) => key === "local-wallets",
              ),
            ).toMatchObject({ usedAmount: 10n, remainingAmount: 0n });
            const events = yield* repository.audit.organization.findForOrganization(organizationId);
            expect(events.filter(({ event }) => event === "wallet.created")).toHaveLength(2);
            expect(events.filter(({ event }) => event === "signing_key.created")).toHaveLength(2);
          }),
      );
    });
  },
);
