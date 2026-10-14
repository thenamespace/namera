import { describe, expect, layer } from "@effect/vitest";
import { DateTime, Deferred, Effect, Fiber, Result, Schema } from "effect";

import { Application, lockOrganizationBilling } from "@namera-ai/application";
import { Database, Repository, TransactionService } from "@namera-ai/database";

import {
  findOrganizationRole,
  inviteMember,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

// Observe an actual PostgreSQL waiter, rather than assuming fork order proves overlap.
const waitForBillingLock = Effect.gen(function* () {
  const db = yield* Database;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const rows = yield* db.execute(`select exists (
      select 1 from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and wait_event_type = 'Lock' and query like '%"billing"."account"%'
    ) as waiting`);
    if (
      Schema.decodeUnknownSync(
        Schema.Struct({ rows: Schema.Array(Schema.Struct({ waiting: Schema.Boolean })) }),
      )(rows).rows[0]?.waiting
    )
      return;
    yield* Effect.yieldNow;
  }
  return yield* Effect.die("Expected competing workflow to wait for the billing lock");
});

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "PostgreSQL member capacity",
  () => {
    layer(TestServerLayer)((it) => {
      for (const first of ["admission", "acceptance"] as const) {
        it.effect(`preserves reserved seats when ${first} holds the billing lock first`, () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const owner = yield* signIn(client, testEmail("seat-owner@example.com"));
            const organizationId = owner.actor.organization.id;
            const role = yield* findOrganizationRole(organizationId, "member");
            const email = testEmail("seat-recipient@example.com");
            const invitation = yield* inviteMember(client, email, organizationId);
            for (const index of [1, 2, 3]) {
              yield* inviteMember(client, testEmail(`seat-${index}@example.com`), organizationId);
            }
            const recipient = yield* signIn(client, email);
            const app = yield* Application;
            const repository = yield* Repository;
            const transaction = yield* TransactionService;
            const now = yield* DateTime.now;
            expect(
              yield* repository.billing.usage.getForOrganization(organizationId, now),
            ).toMatchObject({ members: 1, pendingInvitations: 4 });

            const accept = app.organization.invitation.acceptInvitation({
              invitationId: invitation.invitation.id,
              email,
              userId: recipient.actor.user.id,
              sessionId: recipient.actor.session.id,
            });
            const admit = app.organization.invitation
              .createInvitation({
                organizationId,
                organizationRoleId: role.id,
                email: testEmail("seat-overflow@example.com"),
                inviterId: owner.actor.user.id,
                actorId: owner.actor.actorId,
                inviterRole: owner.actor.role,
              })
              .pipe(Effect.result);
            const ready = yield* Deferred.make<void>();
            const release = yield* Deferred.make<void>();
            const held = yield* transaction
              .run(
                Effect.gen(function* () {
                  yield* lockOrganizationBilling(repository, organizationId);
                  if (first === "acceptance") yield* accept;
                  else
                    expect(yield* admit).toMatchObject({
                      _tag: "Failure",
                      failure: { code: "LIMIT_EXCEEDED", limit: "members" },
                    });
                  yield* Deferred.succeed(ready, undefined);
                  yield* Deferred.await(release);
                }),
              )
              .pipe(Effect.forkChild);
            yield* Deferred.await(ready);
            const competing = yield* (
              first === "admission"
                ? accept.pipe(Effect.asVoid)
                : admit.pipe(
                    Effect.map((result) => {
                      expect(Result.isFailure(result)).toBe(true);
                      if (Result.isFailure(result))
                        expect(result.failure).toMatchObject({
                          code: "LIMIT_EXCEEDED",
                          limit: "members",
                        });
                    }),
                  )
            ).pipe(Effect.forkChild);
            yield* waitForBillingLock.pipe(Effect.ensuring(Deferred.succeed(release, undefined)));
            yield* Fiber.join(held);
            yield* Fiber.join(competing);

            expect(
              yield* repository.billing.usage.getForOrganization(organizationId, now),
            ).toMatchObject({ members: 2, pendingInvitations: 3 });
            const events = yield* repository.audit.organization.findForOrganization(organizationId);
            expect(events.filter((event) => event.event === "invitation.accepted")).toHaveLength(1);
            expect(events.filter((event) => event.event === "invitation.created")).toHaveLength(4);
            expect(
              yield* repository.auth.member.findActiveMembership(
                recipient.actor.user.id,
                organizationId,
              ),
            ).toBeDefined();
            expect(
              (yield* repository.auth.invitation.findByIdForEmail(invitation.invitation.id, email))
                ?.invitation.status,
            ).toBe("accepted");
          }),
        );
      }
    });
  },
);
