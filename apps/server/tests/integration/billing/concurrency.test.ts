import { describe, expect, layer } from "@effect/vitest";
import { DateTime, Effect, Predicate, Result } from "effect";

import {
  enforceLocalWalletLimit,
  freeBillingPlan,
  lockOrganizationBilling,
  makeBillingMetering,
  makeBillingPeriods,
} from "@namera-ai/application";
import { Repository, TransactionService } from "@namera-ai/database";
import { Hex, SigningKeyId } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { createTestManagedWallet } from "../../fixtures/managed-wallet.js";

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "PostgreSQL billing concurrency",
  () => {
    layer(TestServerLayer)((it) => {
      it.effect("settles concurrent passkey creation retries once at the wallet cap", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const { actor } = yield* signIn(client, testEmail("wallet-retry-cap@example.com"));
          const organizationId = actor.organization.id;
          const wallet = yield* createTestManagedWallet(client, {
            payload: {
              namespace: "eip155",
              owner: { type: "namera-managed", protectionLevel: "software" },
              metadata: { version: 1, name: "Capacity template" },
            },
          });
          const repository = yield* Repository;
          const stored = yield* repository.core.wallet.findById(wallet.id, organizationId);
          if (stored === undefined) return yield* Effect.die("Expected fixture wallet");
          const capacityKey = yield* repository.core.signingKey.insert({
            id: SigningKeyId.make("00000000-0000-7000-8000-000000000001"),
            organizationId,
            purpose: "wallet-root",
            custody: "local",
            algorithm: "p256",
            publicKeyHex: Hex.make(`0x04${"02".repeat(64)}`),
            status: "active",
            data: {
              version: 1,
              type: "passkey",
              credentialId: "capacity-fixture",
              rpId: "dashboard.test",
              signCount: 0,
              transports: ["internal"],
            },
          });
          // Occupancy is a fixture; all competing mutations use the public create route.
          for (let index = 0; index < 49; index++) {
            yield* repository.core.wallet.insert({
              organizationId,
              signingKeyId: capacityKey.id,
              createdByActorId: stored.wallet.createdByActorId,
              namespace: wallet.namespace,
              metadata: wallet.metadata,
              data: stored.wallet.data,
              status: "active",
            });
          }
          const registration = yield* client.wallet.createPasskeyRegistrationOptions();
          const request = {
            payload: {
              namespace: "eip155" as const,
              metadata: { version: 1 as const, name: "Last slot" },
              owner: {
                type: "passkey" as const,
                verificationId: registration.verificationId,
                response: {
                  id: "test-passkey",
                  rawId: "test-passkey",
                  type: "public-key" as const,
                  response: { clientDataJSON: "dGVzdA", attestationObject: "dGVzdA" },
                  clientExtensionResults: {},
                },
              },
            },
          };
          const outcomes = yield* Effect.all(
            Array.from({ length: 8 }, () => client.wallet.create(request).pipe(Effect.result)),
            { concurrency: 8 },
          );
          expect(outcomes.filter(Result.isFailure).map((outcome) => outcome.failure)).toHaveLength(
            7,
          );
          expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
          for (const outcome of outcomes.filter(Result.isFailure)) {
            // A retry can pass the initial cap check before the winner commits,
            // then find that its shared registration has already been consumed.
            if (Predicate.isTagged(outcome.failure, "PasskeyVerificationError")) {
              expect(outcome.failure).toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
            } else {
              expect(outcome.failure).toMatchObject({
                _tag: "BillingError",
                code: "LIMIT_EXCEEDED",
                limit: "localWallets",
              });
            }
          }
          expect(
            (yield* client.billing.get()).resources.find(({ key }) => key === "local-wallets"),
          ).toMatchObject({ usedAmount: 50n, remainingAmount: 0n });
          const events = yield* repository.audit.organization.findForOrganization(organizationId);
          // The fixture and the single successful request each have one atomic audit pair.
          expect(events.filter((event) => event.event === "wallet.created")).toHaveLength(2);
          expect(events.filter((event) => event.event === "signing_key.created")).toHaveLength(2);
        }),
      );

      it.effect(
        "admits only one local wallet when concurrent transactions compete for the last slot",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const { actor } = yield* signIn(
              client,
              testEmail("concurrent-local-wallets@example.com"),
            );
            const organizationId = actor.organization.id;
            const registration = yield* client.wallet.createPasskeyRegistrationOptions();
            const wallet = yield* client.wallet.create({
              payload: {
                namespace: "eip155",
                metadata: { version: 1, name: "Capacity fixture" },
                owner: {
                  type: "passkey",
                  verificationId: registration.verificationId,
                  response: {
                    id: "test-passkey",
                    rawId: "test-passkey",
                    type: "public-key",
                    response: { clientDataJSON: "dGVzdA", attestationObject: "dGVzdA" },
                    clientExtensionResults: {},
                  },
                },
              },
            });
            const repository = yield* Repository;
            const transaction = yield* TransactionService;
            const periods = yield* makeBillingPeriods;
            const stored = yield* repository.core.wallet.findById(wallet.id, organizationId);
            if (stored === undefined) return yield* Effect.die("Expected capacity fixture wallet");
            const insert = {
              organizationId,
              signingKeyId: wallet.owner.signingKeyId,
              createdByActorId: stored.wallet.createdByActorId,
              namespace: wallet.namespace,
              metadata: wallet.metadata,
              data: stored.wallet.data,
              status: "active" as const,
            };
            // Seed resource occupancy directly; only admission is under test here.
            for (let index = 1; index < 9; index++) yield* repository.core.wallet.insert(insert);
            const admit = transaction.run(
              Effect.gen(function* () {
                yield* lockOrganizationBilling(repository, organizationId);
                yield* enforceLocalWalletLimit(repository, organizationId, periods);
                return yield* repository.core.wallet.insert(insert);
              }),
            );
            const outcomes = yield* Effect.all(
              Array.from({ length: 8 }, () => admit.pipe(Effect.result)),
              { concurrency: 8 },
            );
            expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
            const failures = outcomes.filter(Result.isFailure);
            expect(failures).toHaveLength(7);
            for (const failure of failures)
              expect(failure.failure).toMatchObject({
                code: "LIMIT_EXCEEDED",
                limit: "localWallets",
              });
            expect(
              (yield* client.billing.get()).resources.find(({ key }) => key === "local-wallets"),
            ).toMatchObject({ usedAmount: 10n, remainingAmount: 0n });
          }),
      );

      it.effect("serializes competing admissions at each Free meter's hard limit", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const { actor } = yield* signIn(client, testEmail("concurrent-meters@example.com"));
          const organizationId = actor.organization.id;
          const metering = yield* makeBillingMetering;
          const expiresAt = DateTime.add(yield* DateTime.now, { minutes: 5 });
          const repository = yield* Repository;

          for (const definition of Object.values(freeBillingPlan.meters)) {
            const outcomes = yield* Effect.all(
              Array.from({ length: 8 }, (_, index) =>
                metering
                  .reserve({
                    organizationId,
                    meterKey: definition.key,
                    amount: definition.hardLimitAmount / 4n,
                    sourceType: "manual-adjustment",
                    sourceId: `${definition.key}:${index}`,
                    expiresAt,
                  })
                  .pipe(Effect.result),
              ),
              { concurrency: 8 },
            );
            expect(outcomes.filter(Result.isSuccess)).toHaveLength(4);
            const failures = outcomes.filter(Result.isFailure);
            expect(failures).toHaveLength(4);
            for (const failure of failures)
              expect(failure.failure).toMatchObject({
                code: "LIMIT_EXCEEDED",
                limit: definition.key,
              });
            const period = yield* repository.billing.period.findOpen(organizationId);
            if (period === undefined) return yield* Effect.die("Expected billing period");
            expect(
              yield* repository.billing.meterBalance.find(
                organizationId,
                period.id,
                definition.key,
              ),
            ).toMatchObject({
              consumedAmount: 0n,
              reservedAmount: definition.hardLimitAmount,
            });
          }
        }),
      );

      it.effect("deduplicates concurrent reservation and settlement retries", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const { actor } = yield* signIn(client, testEmail("concurrent-settlement@example.com"));
          const organizationId = actor.organization.id;
          const metering = yield* makeBillingMetering;
          const repository = yield* Repository;
          const input = {
            organizationId,
            meterKey: "execution.mainnet" as const,
            amount: 20n,
            sourceType: "manual-adjustment" as const,
            sourceId: "same-operation",
            expiresAt: DateTime.add(yield* DateTime.now, { minutes: 5 }),
          };
          const reservations = yield* Effect.all(
            Array.from({ length: 8 }, () => metering.reserve(input)),
            { concurrency: 8 },
          );
          expect(new Set(reservations.map((reservation) => reservation.id)).size).toBe(1);
          const reservation = reservations[0];
          if (reservation === undefined) return yield* Effect.die("Expected reservation");
          const settled = yield* Effect.all(
            Array.from({ length: 8 }, () =>
              metering.settle({ organizationId, reservationId: reservation.id, amount: 12n }),
            ),
            { concurrency: 8 },
          );
          expect(settled.every((event) => event !== undefined)).toBe(true);
          expect(new Set(settled.map((event) => event?.id)).size).toBe(1);
          yield* Effect.all(
            Array.from({ length: 8 }, () =>
              metering.release({ organizationId, reservationId: reservation.id }),
            ),
            { concurrency: 8 },
          );
          expect(
            yield* repository.billing.meterBalance.find(
              organizationId,
              reservation.periodId,
              "execution.mainnet",
            ),
          ).toMatchObject({ consumedAmount: 12n, reservedAmount: 0n });
          expect(
            yield* repository.billing.usageEvent.listForMeter(
              organizationId,
              reservation.periodId,
              "execution.mainnet",
            ),
          ).toHaveLength(1);
        }),
      );

      it.effect(
        "creates one anniversary period and one set of balances under concurrent rollover",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const { actor } = yield* signIn(client, testEmail("concurrent-rollover@example.com"));
            const organizationId = actor.organization.id;
            const periods = yield* makeBillingPeriods;
            const repository = yield* Repository;
            const initial = yield* repository.billing.period.findOpen(organizationId);
            if (initial === undefined) return yield* Effect.die("Expected initial period");
            const next = DateTime.add(initial.endsAt, { seconds: 1 });
            const results = yield* Effect.all(
              Array.from({ length: 8 }, () => periods.current(organizationId, next)),
              { concurrency: 8 },
            );
            expect(new Set(results.map((period) => period.id)).size).toBe(1);
            const current = yield* repository.billing.period.findOpen(organizationId);
            if (current === undefined) return yield* Effect.die("Expected open period");
            expect(current.id).not.toBe(initial.id);
            expect(
              yield* repository.billing.period.listForSubscription(
                organizationId,
                current.subscriptionId,
              ),
            ).toHaveLength(2);
            expect(
              yield* repository.billing.meterBalance.listForPeriod(organizationId, current.id),
            ).toHaveLength(4);
          }),
      );
    });
  },
);
