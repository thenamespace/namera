import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution, makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  getReceipt: (input) =>
    provider.getReceipt(input).pipe(
      Effect.map(
        Option.map((receipt) => ({
          ...receipt,
          actualGasCost: 0n,
          sender: EthereumAddress.make(`0x${"33".repeat(20)}`),
        })),
      ),
    ),
});

layer(fixture.layer)("BSO gas billing", (it) => {
  for (const outcome of ["immediate", "failed"] as const) {
    it.effect(`retains a zero-receipt hold until provider cost arrives (${outcome})`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`bso-${outcome}@example.com`));
        const organizationId = owner.actor.organization.id;
        const repository = yield* Repository;
        const app = yield* Application;
        const control = yield* TestEvmExecution;
        yield* control.setSponsorshipCost(Option.none());
        yield* control.setReceiptMode(outcome);
        const { session } = yield* registerPendingLocalSession(client, ["eip155:42161"]);
        const installation = session.installations[0];
        if (!installation) return yield* Effect.die("Missing installation");
        const prepared = yield* client.sessionKey.prepareOperation({
          payload: {
            installationId: installation.id,
            kind: "install",
            sponsor: true,
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
              counter: 0,
            }),
          },
        });
        yield* TestClock.adjust("2 seconds");
        yield* app.sessionKey.reconcileOperations();
        const reservations = yield* repository.billing.usageReservation.listBySource(
          organizationId,
          "session-key-operation",
          prepared.operationId,
        );
        const gas = reservations.find((reservation) => reservation.meterKey === "gas-sponsorship");
        if (!gas) return yield* Effect.die("Missing gas hold");
        expect(gas.status).toBe("active");
        expect(
          reservations.find((reservation) => reservation.meterKey === "execution.mainnet")?.status,
        ).toBe("settled");
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe(outcome === "immediate" ? "active" : "pending");
        expect(
          yield* Effect.all(
            Array.from({ length: 4 }, () => app.billing.reconcileSponsorships()),
            { concurrency: 4 },
          ),
        ).toEqual([0, 0, 0, 0]);
        expect(
          yield* repository.billing.meterBalance.find(
            organizationId,
            gas.periodId,
            "gas-sponsorship",
          ),
        ).toMatchObject({ consumedAmount: 0n, reservedAmount: gas.amount });

        let previousAttempt = yield* repository.billing.usageReservation.findById(
          organizationId,
          gas.id,
        );
        if (!previousAttempt) return yield* Effect.die("Missing attempted hold");
        for (const [index, delay] of [10, 20, 40, 80, 160, 300, 300].entries()) {
          expect(previousAttempt.sponsorshipAttempts).toBe(index + 1);
          expect(
            DateTime.toEpochMillis(previousAttempt.expiresAt) -
              DateTime.toEpochMillis(yield* DateTime.now),
          ).toBe(delay * 1000);
          yield* TestClock.adjust(`${delay - 1} seconds`);
          expect(yield* app.billing.reconcileSponsorships()).toBe(0);
          expect(
            (yield* repository.billing.usageReservation.findById(organizationId, gas.id))
              ?.sponsorshipAttempts,
          ).toBe(index + 1);
          yield* TestClock.adjust("1 second");
          expect(yield* app.billing.reconcileSponsorships()).toBe(0);
          const nextAttempt = yield* repository.billing.usageReservation.findById(
            organizationId,
            gas.id,
          );
          if (!nextAttempt) return yield* Effect.die("Missing retried hold");
          // A late failure from an older claim cannot replace the current retry schedule.
          yield* repository.billing.usageReservation.retrySponsorship(
            previousAttempt,
            yield* DateTime.now,
          );
          expect(
            (yield* repository.billing.usageReservation.findById(organizationId, gas.id))
              ?.expiresAt,
          ).toEqual(nextAttempt.expiresAt);
          previousAttempt = nextAttempt;
        }

        // A provider total above the authorized hold requires investigation, not an overcharge.
        yield* control.setSponsorshipCost(
          Option.some({ amountMicroUsd: gas.amount + 1n, confirmedTotalUsd: "1" }),
        );
        yield* TestClock.adjust("5 minutes");
        expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 0 });
        expect(
          (yield* repository.billing.usageReservation.findById(organizationId, gas.id))?.status,
        ).toBe("active");

        yield* control.setSponsorshipCost(
          Option.some({ amountMicroUsd: 9644n, confirmedTotalUsd: "0.0096432" }),
        );
        yield* TestClock.adjust("5 minutes");
        expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 1 });
        expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 0 });
        expect(
          yield* repository.billing.meterBalance.find(
            organizationId,
            gas.periodId,
            "gas-sponsorship",
          ),
        ).toMatchObject({ consumedAmount: 9644n, reservedAmount: 0n });
        expect(
          yield* repository.billing.usageEvent.getNetAmount(
            organizationId,
            gas.periodId,
            "gas-sponsorship",
          ),
        ).toBe(9644n);
        expect(
          (yield* client.billing.get()).meters.find((meter) => meter.key === "gas-sponsorship")
            ?.remainingAmount,
        ).toBe(2_990_356n);
        yield* control.setSponsorshipCost(
          Option.some({ amountMicroUsd: 32_400n, confirmedTotalUsd: "0.0324" }),
        );
        yield* control.setReceiptMode("immediate");
      }),
    );
  }
});
