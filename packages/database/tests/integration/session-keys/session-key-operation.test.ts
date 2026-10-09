import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";

import { Hex, TransactionHash, UserOperationHash } from "@namera-ai/protocol";

import { Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { sessionOperationFixture } from "../../fixtures/session-operation.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);
const time = DateTime.fromEpochSeconds;

layer(Persistence)("durable session owner operations", (it) => {
  it.effect(
    "binds approvals, persists exact JSON, rejects replays and reconciles only under a live lease",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).core.sessionKeyOperation;
        const fixture = yield* sessionOperationFixture("owner-approval");
        const other = yield* sessionOperationFixture("other-owner");
        const { operation, inserted } = yield* repository.insert(fixture.input);
        expect(inserted).toBe(true);
        expect((yield* repository.insert(fixture.input)).inserted).toBe(false);
        expect(DateTime.formatIso(operation.data.prepared.context.block.timestamp)).toBe(
          "2026-09-01T00:00:00.000Z",
        );
        const scope = { id: operation.id, organizationId: operation.organizationId };
        expect(
          yield* repository.findById({ ...scope, organizationId: other.organization.id }),
        ).toBeUndefined();
        const approval = {
          ...scope,
          actorId: fixture.actor.id,
          requestHash: fixture.input.requestHash,
          signed: fixture.signed,
          now: time(90),
          leaseToken: "http-lease",
          leaseExpiresAt: time(110),
        };
        expect(
          yield* repository.acceptSignature({ ...approval, actorId: other.actor.id }),
        ).toBeUndefined();
        expect(
          yield* repository.acceptSignature({ ...approval, requestHash: "changed" }),
        ).toBeUndefined();
        expect(yield* repository.acceptSignature({ ...approval, now: time(100) })).toBeUndefined();
        const transactions = yield* TransactionService;
        expect(
          yield* transactions
            .run(
              Effect.gen(function* () {
                yield* repository.acceptSignature(approval);
                return yield* Effect.fail("rollback");
              }),
            )
            .pipe(Effect.flip),
        ).toBe("rollback");
        expect((yield* repository.findById(scope))?.status).toBe("awaiting-signature");
        expect((yield* repository.acceptSignature(approval))?.data.signed).toEqual(fixture.signed);
        expect(yield* repository.acceptSignature(approval)).toBeUndefined();
        expect(yield* repository.expireAwaitingSignatures({ now: time(101), limit: 10 })).toEqual(
          [],
        );
        expect(
          yield* repository.markSubmitted({ ...scope, leaseToken: "http-lease", now: time(110) }),
        ).toBeUndefined();
        const claimed = yield* repository.claimForReconciliation({
          now: time(110),
          leaseToken: "worker-lease",
          leaseExpiresAt: time(130),
          limit: 10,
        });
        expect(claimed.map((row) => row.id)).toEqual([operation.id]);
        expect(
          yield* repository.claimForReconciliation({
            now: time(111),
            leaseToken: "competing-worker",
            leaseExpiresAt: time(140),
            limit: 10,
          }),
        ).toEqual([]);
        const lease = { ...scope, leaseToken: "worker-lease", now: time(111) };
        expect((yield* repository.markSubmitted(lease))?.status).toBe("submitted");
        const receipt = {
          ...lease,
          userOperationHash: fixture.signed.userOperationHash,
          transactionHash: TransactionHash.make(`0x${"33".repeat(32)}`),
          success: true,
        };
        expect(
          yield* repository.finishReceipt({ ...receipt, leaseToken: "http-lease" }),
        ).toBeUndefined();
        expect(
          yield* repository.finishReceipt({
            ...receipt,
            userOperationHash: UserOperationHash.make(`0x${"22".repeat(32)}`),
          }),
        ).toBeUndefined();
        yield* repository.releaseLease({ ...lease, nextReconcileAt: time(140) });
        expect(yield* repository.finishReceipt(receipt)).toBeUndefined();
        expect(
          yield* repository.claimForReconciliation({
            now: time(139),
            leaseToken: "early-worker",
            leaseExpiresAt: time(160),
            limit: 10,
          }),
        ).toEqual([]);
        yield* repository.claimForReconciliation({
          now: time(140),
          leaseToken: "next-worker",
          leaseExpiresAt: time(160),
          limit: 10,
        });
        const finalReceipt = { ...receipt, leaseToken: "next-worker", now: time(141) };
        expect((yield* repository.finishReceipt(finalReceipt))?.status).toBe("confirmed");
        expect(yield* repository.finishReceipt(finalReceipt)).toBeUndefined();
        expect(
          yield* repository.claimForReconciliation({
            now: time(150),
            leaseToken: "late-worker",
            leaseExpiresAt: time(180),
            limit: 10,
          }),
        ).toEqual([]);
      }),
  );

  it.effect(
    "enforces attempt uniqueness, chain ownership and signed field integrity, and expires only unsigned attempts",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).core.sessionKeyOperation;
        const fixture = yield* sessionOperationFixture("attempt-constraints");
        const other = yield* sessionOperationFixture("attempt-other-tenant");
        expect(
          yield* repository.insert({ ...fixture.input, actorId: other.actor.id }).pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        expect(
          yield* repository
            .insert({ ...fixture.input, installationId: other.installation.id })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        const { operation } = yield* repository.insert(fixture.input);
        expect(
          yield* repository
            .insert({
              ...fixture.input,
              kind: "uninstall",
              idempotencyKey: "other-owner-operation",
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        expect(
          yield* repository
            .insert({ ...fixture.input, idempotencyKey: "another-attempt" })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        expect(
          yield* repository
            .insert({
              ...fixture.input,
              idempotencyKey: "wrong-chain",
              kind: "uninstall",
              chainId: "eip155:1",
              data: {
                ...fixture.input.data,
                prepared: { ...fixture.input.data.prepared, chainId: "eip155:1" },
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        const accept = {
          id: operation.id,
          organizationId: operation.organizationId,
          actorId: fixture.actor.id,
          requestHash: fixture.input.requestHash,
          now: time(90),
          leaseToken: "request",
          leaseExpiresAt: time(110),
        };
        expect(
          yield* repository
            .acceptSignature({
              ...accept,
              signed: {
                ...fixture.signed,
                billing: { ...fixture.signed.billing, executionMeter: "execution.mainnet" },
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        expect(
          yield* repository
            .acceptSignature({
              ...accept,
              signed: {
                ...fixture.signed,
                userOperation: {
                  ...fixture.signed.userOperation,
                  callData: Hex.make("0xcd"),
                },
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        expect(
          (yield* repository.expireAwaitingSignatures({ now: time(100), limit: 10 })).map(
            (row) => row.id,
          ),
        ).toEqual([operation.id]);
        expect(
          yield* repository.acceptSignature({ ...accept, signed: fixture.signed }),
        ).toBeUndefined();
        const retry = yield* repository.insert({
          ...fixture.input,
          idempotencyKey: "new-attempt",
          expiresAt: time(200),
        });
        expect(retry.inserted).toBe(true);
        yield* repository.acceptSignature({
          ...accept,
          id: retry.operation.id,
          now: time(101),
          leaseExpiresAt: time(120),
          signed: fixture.signed,
        });
        expect(
          (yield* repository.finishReceipt({
            id: retry.operation.id,
            organizationId: retry.operation.organizationId,
            now: time(102),
            leaseToken: "request",
            transactionHash: TransactionHash.make(`0x${"44".repeat(32)}`),
            userOperationHash: fixture.signed.userOperationHash,
            success: false,
          }))?.status,
        ).toBe("failed");
        expect(
          (yield* repository.findById({
            id: operation.id,
            organizationId: operation.organizationId,
          }))?.status,
        ).toBe("expired");
      }),
  );
});
