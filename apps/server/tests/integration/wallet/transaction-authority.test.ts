import { expect, layer } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, Repository, organizationMember } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { EthereumAddress, Hex } from "@namera-ai/protocol";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet } from "../../fixtures/local-session.js";

const authenticator = createTestAuthenticator();
const execution = makeTestEvmExecutionService({}, { signWithOwner: true });
const testLayer = makeTestServerLayer(
  {
    execution: {
      sign: execution.sign,
      ownerApprovalChallenge: () => Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
      completeOwnerApproval: makeTestEvmExecutionService().sign,
    },
  },
  authenticator.layer,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);
const request = {
  namespace: "eip155" as const,
  chainId: "eip155:8453" as const,
  sponsor: false,
  calls: [
    {
      to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
      value: 0n,
      data: Hex.make("0x"),
    },
  ],
};

layer(testLayer)("wallet transaction owner authority", (it) => {
  for (const custody of ["passkey", "1claw"] as const) {
    for (const role of ["admin", "member", "custom"] as const) {
      it.effect(`rejects ${role} preparation and stale approval for ${custody} custody`, () =>
        Effect.gen(function* () {
          yield* resetTestState();
          yield* TestClock.setTime(Date.now());
          const author = yield* signIn(
            yield* makeTestApiClient,
            testEmail(`transaction-${custody}-${role}@example.com`),
          );
          const client = yield* handledApi(NameraApi, {
            headers: {
              cookie: `auth-token=${author.cookie.value}`,
              origin: "http://dashboard.test",
            },
          });
          const wallet =
            custody === "passkey"
              ? yield* createTestPasskeyWallet(client)
              : yield* client.wallet.create({
                  payload: {
                    namespace: "eip155",
                    owner: { type: "namera-managed", provider: "1claw" },
                    metadata: { version: 1, name: "Treasury" },
                  },
                });
          const params = { walletId: wallet.id };
          const input = { params, headers: { "idempotency-key": "authority" }, payload: request };
          const prepared = yield* client.walletTransaction.prepare(input);
          const completion = {
            params,
            payload: {
              namespace: "eip155" as const,
              operationId: prepared.operationId,
              ...(prepared.signing.method === "passkey"
                ? {
                    response: authenticator.authenticate({
                      challenge: prepared.signing.options.challenge,
                      origin: "http://dashboard.test",
                      rpId: "dashboard.test",
                      counter: 0,
                    }),
                  }
                : {}),
            },
          };
          const repository = yield* Repository;
          const organizationId = author.actor.organization.id;
          const roles = yield* repository.auth.role.findOrganizationRolesForOrgId(organizationId);
          const replacement =
            role === "custom"
              ? yield* repository.auth.role.insert({
                  organizationId,
                  key: "transaction-editor",
                  metadata: { version: 1, name: "Transaction editor" },
                  permissions: ["wallet:read", "wallet:update"],
                })
              : roles.find((candidate) => candidate.key === role);
          if (!replacement) return yield* Effect.die("Missing replacement role");
          const db = yield* Database;
          const members = yield* db.query.organizationMember.findMany();
          expect(members).toHaveLength(1);
          const membership = members[0];
          if (!membership) return yield* Effect.die("Missing membership");
          // The public API protects Owner demotion. Seed a stale approval explicitly
          // to exercise current authority rechecks independently of HTTP middleware.
          yield* db.update(organizationMember).set({ organizationRoleId: replacement.id });
          const control = yield* OneClawTestControl;
          yield* Ref.set(control.calls, []);
          const eventsBefore = yield* db.query.organizationEvent.findMany();
          const holdsBefore = yield* db.query.billingUsageReservation.findMany();

          expect(yield* client.walletTransaction.prepare(input).pipe(Effect.flip)).toMatchObject({
            _tag: "Forbidden",
          });
          expect(
            yield* client.walletTransaction
              .prepare({ ...input, headers: { "idempotency-key": "new-admin-operation" } })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });
          expect(
            yield* client.walletTransaction.complete(completion).pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });
          expect(
            yield* client.walletTransaction
              .cancel({ params: { ...params, operationId: prepared.operationId } })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });
          expect(
            yield* client.walletTransaction
              .get({ params: { ...params, operationId: prepared.operationId } })
              .pipe(Effect.flip),
          ).toMatchObject({ _tag: "Forbidden" });

          const transactions = (yield* Application).wallet.transactions;
          const scope = { organizationId, actorId: author.actor.actorId, walletId: wallet.id };
          expect(
            yield* transactions
              .prepare({ ...scope, idempotencyKey: "application-blocked", request })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "OWNER_UNAVAILABLE" });
          expect(
            yield* transactions
              .complete({ ...scope, request: completion.payload })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "OWNER_UNAVAILABLE" });
          expect(
            yield* transactions
              .get({ ...scope, operationId: prepared.operationId })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "OWNER_UNAVAILABLE" });
          expect(yield* Ref.get(control.calls)).toEqual([]);
          const operations = yield* db.query.walletOperation.findMany();
          expect(operations).toHaveLength(1);
          expect(operations[0]).toMatchObject({
            status: "awaiting-signature",
            data: { signed: null },
          });
          expect(yield* db.query.organizationEvent.findMany()).toEqual(eventsBefore);
          expect(yield* db.query.billingUsageReservation.findMany()).toEqual(holdsBefore);

          yield* db
            .update(organizationMember)
            .set({ organizationRoleId: membership.organizationRoleId });
          expect((yield* client.walletTransaction.complete(completion)).status).toBe("signed");
          if (custody === "1claw")
            expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
        }),
      );
    }
  }
});
