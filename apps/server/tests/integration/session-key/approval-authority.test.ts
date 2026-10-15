import { expect, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { makeTestEvmExecutionService, TestEvmExecution } from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { Hex } from "@namera-ai/protocol";

import {
  createMember,
  findOrganizationRole,
  setAuthToken,
  testEmail,
} from "../../fixtures/index.js";
import { managedSessionLayer } from "../../fixtures/managed-session.js";
import { setupSessionCustody } from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  for (const kind of ["install", "uninstall"] as const) {
    for (const change of ["downgrade", "remove"] as const) {
      for (const winner of ["membership", "approval"] as const) {
        it.effect(
          `${owner} ${kind} ${change}: ${winner} wins without invalidating accepted operations`,
          () =>
            Effect.gen(function* () {
              const started = yield* Deferred.make<void>();
              const release = yield* Deferred.make<void>();
              const authenticator = createTestAuthenticator();
              const execution = makeTestEvmExecutionService(
                {},
                { signWithOwner: owner === "1claw" },
              );
              const armed = yield* Deferred.make<void>();
              const sign: typeof execution.sign = (input) =>
                execution
                  .sign(input)
                  .pipe(
                    Effect.tap(() =>
                      Deferred.isDone(armed).pipe(
                        Effect.flatMap((gated) =>
                          gated
                            ? Deferred.succeed(started, undefined).pipe(
                                Effect.andThen(Deferred.await(release)),
                              )
                            : Effect.void,
                        ),
                      ),
                    ),
                  );
              yield* Effect.gen(function* () {
                const f = yield* setupSessionCustody(owner, "local");
                const admin = yield* createMember(
                  f.client,
                  testEmail(`${crypto.randomUUID()}@example.com`),
                  "admin",
                );
                const memberRole = yield* findOrganizationRole(f.organizationId, "member");
                const installation = f.session.installations[0];
                if (!installation) return yield* Effect.die("Missing installation");
                const prepare = Effect.fn(function* (action: "install" | "uninstall") {
                  const payload = {
                    installationId: installation.id,
                    kind: action,
                    sponsor: true,
                    idempotencyKey: crypto.randomUUID(),
                  };
                  if (owner === "1claw") {
                    const prepared = yield* f.client.sessionKey.prepareManagedOperation({
                      payload,
                    });
                    return {
                      prepared,
                      approve: f.client.sessionKey.approveManagedOperation({
                        payload: { operationId: prepared.operationId },
                      }),
                    };
                  }
                  const prepared = yield* f.client.sessionKey.prepareOperation({ payload });
                  return {
                    prepared,
                    approve: f.client.sessionKey.completeOperation({
                      payload: {
                        operationId: prepared.operationId,
                        response: authenticator.authenticate({
                          challenge: prepared.options.challenge,
                          origin: "http://dashboard.test",
                          rpId: "dashboard.test",
                          counter: action === "install" ? 1 : 2,
                        }),
                      },
                    }),
                  };
                });
                const app = yield* Application;
                const chain = yield* TestEvmExecution;
                if (kind === "uninstall") {
                  yield* (yield* prepare("install")).approve;
                  yield* chain.setReceiptMode("immediate");
                  yield* TestClock.adjust(Duration.seconds(2));
                  yield* app.sessionKey.reconcileOperations();
                  yield* f.client.sessionKey.revoke({ params: { sessionKeyId: f.session.id } });
                }
                const operation = yield* prepare(kind);
                const scope = {
                  id: operation.prepared.operationId,
                  organizationId: f.organizationId,
                };
                const holds = f.repository.billing.usageReservation.listBySource(
                  f.organizationId,
                  "session-key-operation",
                  scope.id,
                );
                const audits = f.repository.audit.organization
                  .findForOrganization(f.organizationId)
                  .pipe(
                    Effect.map((rows) =>
                      rows.filter(
                        (row) =>
                          row.event === "session_key.operation_approved" &&
                          row.data.operationId === scope.id,
                      ),
                    ),
                  );
                const keyBefore = (yield* f.repository.core.wallet.findById(
                  f.wallet.id,
                  f.organizationId,
                ))?.signingKey.data;
                yield* Deferred.succeed(armed, undefined);
                const fiber = yield* operation.approve.pipe(Effect.result, Effect.forkChild);
                yield* Deferred.await(started);
                if (winner === "approval") {
                  yield* Deferred.succeed(release, undefined);
                  expect(yield* Fiber.join(fiber)).toMatchObject({
                    _tag: "Success",
                    success: { status: "signed" },
                  });
                }
                yield* setAuthToken(admin.ownerToken);
                if (change === "remove") {
                  yield* f.client.member.removeMember({
                    payload: { organizationMemberId: admin.actor.member.organizationMember.id },
                  });
                } else {
                  yield* f.client.member.updateMemberRole({
                    payload: {
                      organizationMemberId: admin.actor.member.organizationMember.id,
                      organizationRoleId: memberRole.id,
                    },
                  });
                }
                if (winner === "membership") {
                  yield* Deferred.succeed(release, undefined);
                  expect(yield* Fiber.join(fiber)).toMatchObject({
                    _tag: "Failure",
                    failure: { code: "OPERATION_UNAVAILABLE" },
                  });
                  expect(
                    yield* f.repository.core.sessionKeyOperation.findById(scope),
                  ).toMatchObject({
                    status: "awaiting-signature",
                    data: { signed: null },
                  });
                  expect(yield* holds).toEqual([]);
                  expect(yield* audits).toEqual([]);
                  expect(
                    (yield* f.repository.core.wallet.findById(f.wallet.id, f.organizationId))
                      ?.signingKey.data,
                  ).toEqual(keyBefore);
                } else {
                  expect((yield* holds).every((hold) => hold.status === "active")).toBe(true);
                  expect(yield* holds).toHaveLength(1);
                  expect(yield* audits).toHaveLength(1);
                  yield* chain.setReceiptMode("immediate");
                  yield* TestClock.adjust(Duration.seconds(2));
                  yield* app.sessionKey.reconcileOperations();
                  expect(
                    (yield* f.repository.core.sessionKeyOperation.findById(scope))?.status,
                  ).toBe("confirmed");
                }
              }).pipe(
                Effect.provide(
                  managedSessionLayer(
                    {
                      sign,
                      ownerApprovalChallenge: () =>
                        Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
                      completeOwnerApproval: sign,
                    },
                    authenticator.layer,
                  ),
                ),
              );
            }),
        );
      }
    }
  }
}
