import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { resolveEvmSessionSigner, TestEvmExecution } from "@namera-ai/evm";

import {
  prepareCustodyOperation,
  sessionCustodyLayer,
  setupSessionCustody,
} from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  for (const custody of ["local", "1claw"] as const) {
    layer(sessionCustodyLayer)(`${owner} account + ${custody} session lifecycle`, (it) => {
      it.effect(
        "installs both networks, retries receipts, and removes authority through the owner",
        () =>
          Effect.gen(function* () {
            const { client, wallet, session, organizationId, repository, control } =
              yield* setupSessionCustody(owner, custody);
            const params = { sessionKeyId: session.id };
            const app = yield* Application;
            const chain = yield* TestEvmExecution;
            const parent = yield* repository.core.wallet.findById(wallet.id, organizationId);
            const signer = yield* repository.core.signingKey.findById(
              session.signingKeyId,
              organizationId,
            );
            expect(signer?.purpose).toBe("session");
            expect(parent?.signingKey.purpose).toBe("wallet-root");
            expect(signer?.id).not.toBe(parent?.signingKey.id);
            expect(signer?.publicKeyHex).not.toBe(parent?.signingKey.publicKeyHex);
            const publicSigner = yield* resolveEvmSessionSigner(session.signer.publicKey);
            const installations = yield* repository.core.sessionKeyInstallation.findForSession(
              organizationId,
              session.id,
            );
            expect(installations.map(({ data }) => data.authorization.signerAddress)).toEqual([
              publicSigner.address,
              publicSigner.address,
            ]);
            if (custody === "1claw" && owner === "1claw") {
              expect(signer?.credentialId).not.toBe(parent?.signingKey.credentialId);
            }

            for (const installation of session.installations) {
              const payload = {
                installationId: installation.id,
                kind: "install" as const,
                sponsor: false,
                idempotencyKey: crypto.randomUUID(),
              };
              const wrongOwnerRoute =
                owner === "passkey"
                  ? client.sessionKey.prepareManagedOperation({ payload }).pipe(Effect.asVoid)
                  : client.sessionKey.prepareOperation({ payload }).pipe(Effect.asVoid);
              expect(yield* wrongOwnerRoute.pipe(Effect.flip)).toMatchObject({
                code: "OWNER_UNAVAILABLE",
              });
              const operation = yield* prepareCustodyOperation(client, owner, payload);
              const retry = yield* prepareCustodyOperation(client, owner, payload);
              expect(retry.prepared.operationId).toBe(operation.prepared.operationId);
              expect(yield* operation.approve).toMatchObject({ status: "signed" });
              expect(yield* operation.approve).toMatchObject({ status: "signed" });
              const stored = yield* repository.core.sessionKeyOperation.findById({
                id: operation.prepared.operationId,
                organizationId,
              });
              expect(stored?.data.managedOwner?.signingKeyId).toBe(
                owner === "1claw" ? parent?.signingKey.id : undefined,
              );
              expect(stored?.data.signed).not.toBeNull();
              expect(
                (yield* client.sessionKey.get({ params })).installations.find(
                  ({ id }) => id === installation.id,
                )?.status,
              ).toBe("pending");
              yield* chain.setReceiptMode("missing");
              yield* TestClock.adjust(Duration.seconds(2));
              yield* app.sessionKey.reconcileOperations();
              expect(
                (yield* client.sessionKey.get({ params })).installations.find(
                  ({ id }) => id === installation.id,
                )?.status,
              ).toBe("pending");
              expect(
                (yield* repository.core.sessionKeyOperation.findById({
                  id: operation.prepared.operationId,
                  organizationId,
                }))?.status,
              ).toBe("submitted");
              yield* chain.setReceiptMode("immediate");
              yield* TestClock.adjust(Duration.seconds(16));
              yield* app.sessionKey.reconcileOperations();
              expect(
                (yield* client.sessionKey.get({ params })).installations.find(
                  ({ id }) => id === installation.id,
                )?.status,
              ).toBe("installed");
              const holds = yield* repository.billing.usageReservation.listBySource(
                organizationId,
                "session-key-operation",
                operation.prepared.operationId,
              );
              expect(holds).toHaveLength(1);
              expect(holds[0]?.status).toBe("settled");
            }
            expect((yield* client.sessionKey.get({ params })).status).toBe("active");
            expect(yield* Ref.get(control.calls)).toEqual(
              owner === "1claw" ? ["signing.signDigest", "signing.signDigest"] : [],
            );
            const apiKey = yield* client.apiKey.create({
              payload: {
                metadata: { version: 1, name: "Lifecycle grant" },
                durationDays: 1,
                sessionKeyIds: [session.id],
              },
            });
            expect((yield* client.sessionKey.revoke({ params })).status).toBe("revoking");
            expect(
              yield* repository.core.sessionKeyGrant.findActiveForActor(
                organizationId,
                apiKey.apiKey.actorId,
              ),
            ).toHaveLength(0);
            expect((yield* client.sessionKey.revoke({ params })).status).toBe("revoking");

            // Disabling a session signer cannot prevent its owner removing onchain authority.
            yield* repository.core.signingKey.setStatus(
              session.signingKeyId,
              organizationId,
              "disabled",
            );
            for (const [index, installation] of session.installations.entries()) {
              const operation = yield* prepareCustodyOperation(client, owner, {
                installationId: installation.id,
                kind: "uninstall",
                sponsor: false,
                idempotencyKey: crypto.randomUUID(),
              });
              yield* operation.approve;
              yield* TestClock.adjust(Duration.seconds(2));
              yield* app.sessionKey.reconcileOperations();
              expect((yield* client.sessionKey.get({ params })).status).toBe(
                index === session.installations.length - 1 ? "revoked" : "revoking",
              );
            }
            expect(
              (yield* repository.core.wallet.findById(wallet.id, organizationId))?.signingKey
                .status,
            ).toBe("active");
            expect(
              yield* repository.core.signingKey.findById(session.signingKeyId, organizationId),
            ).toBeDefined();
            if (signer?.credentialId) {
              expect(
                yield* repository.core.credentials.findById(signer.credentialId, organizationId),
              ).toBeDefined();
            }
            expect(yield* Ref.get(control.calls)).toEqual(
              owner === "1claw" ? Array(4).fill("signing.signDigest") : [],
            );
            const audits = yield* repository.audit.organization.findForOrganization(organizationId);
            expect(
              audits.filter(({ event }) => event === "session_key.operation_approved"),
            ).toHaveLength(4);
            expect(
              audits.filter(({ event }) => event === "session_key.revocation_requested"),
            ).toHaveLength(1);
            expect(audits.filter(({ event }) => event === "session_key.revoked")).toHaveLength(1);
          }),
      );

      it.effect("cancels a live unsigned approval when a pending session is revoked", () =>
        Effect.gen(function* () {
          const { client, session, control, repository, organizationId } =
            yield* setupSessionCustody(owner, custody);
          const installation = session.installations[0];
          if (!installation) return yield* Effect.die("Missing fixture installation");
          const operation = yield* prepareCustodyOperation(client, owner, {
            installationId: installation.id,
            kind: "install",
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          });
          expect(
            (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
          ).toBe("revoked");
          expect(yield* operation.approve.pipe(Effect.flip)).toMatchObject({
            code: "APPROVAL_EXPIRED",
          });
          expect(
            yield* repository.core.sessionKeyOperation.findById({
              id: operation.prepared.operationId,
              organizationId,
            }),
          ).toMatchObject({ status: "expired", data: { signed: null } });
          expect(yield* Ref.get(control.calls)).toEqual([]);
        }),
      );

      it.effect("requires a fresh owner approval after an included installation failure", () =>
        Effect.gen(function* () {
          const { client, session } = yield* setupSessionCustody(owner, custody);
          const installation = session.installations[0];
          if (!installation) return yield* Effect.die("Missing fixture installation");
          const params = { sessionKeyId: session.id };
          const payload = {
            installationId: installation.id,
            kind: "install" as const,
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          };
          const failed = yield* prepareCustodyOperation(client, owner, payload);
          yield* failed.approve;
          const app = yield* Application;
          const chain = yield* TestEvmExecution;
          yield* chain.setReceiptMode("failed");
          yield* TestClock.adjust(Duration.seconds(2));
          yield* app.sessionKey.reconcileOperations();
          expect((yield* client.sessionKey.get({ params })).status).toBe("pending");
          expect(yield* failed.approve).toMatchObject({ status: "failed" });
          const retry = yield* prepareCustodyOperation(client, owner, {
            ...payload,
            idempotencyKey: crypto.randomUUID(),
          });
          expect(retry.prepared.operationId).not.toBe(failed.prepared.operationId);
          yield* retry.approve;
          yield* chain.setReceiptMode("immediate");
          yield* TestClock.adjust(Duration.seconds(2));
          yield* app.sessionKey.reconcileOperations();
          expect((yield* client.sessionKey.get({ params })).status).toBe("active");
        }),
      );

      it.effect(
        "expires unsigned approval and revokes a never-installed session without signing",
        () =>
          Effect.gen(function* () {
            const { client, session, control } = yield* setupSessionCustody(owner, custody);
            const installation = session.installations[0];
            if (!installation) return yield* Effect.die("Missing fixture installation");
            const operation = yield* prepareCustodyOperation(client, owner, {
              installationId: installation.id,
              kind: "install",
              sponsor: false,
              idempotencyKey: crypto.randomUUID(),
            });
            yield* TestClock.adjust(Duration.minutes(6));
            expect(yield* operation.approve.pipe(Effect.flip)).toMatchObject({
              code: "APPROVAL_EXPIRED",
            });
            expect(
              (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
            ).toBe("pending");
            yield* TestClock.adjust(Duration.hours(1));
            expect(
              yield* prepareCustodyOperation(client, owner, {
                installationId: installation.id,
                kind: "install",
                sponsor: false,
                idempotencyKey: crypto.randomUUID(),
              }).pipe(Effect.flip),
            ).toMatchObject({ code: "INVALID_TRANSITION" });
            expect(
              (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
            ).toBe("revoked");
            expect(yield* operation.approve.pipe(Effect.flip)).toMatchObject({
              code: "APPROVAL_EXPIRED",
            });
            expect(yield* Ref.get(control.calls)).toEqual([]);
          }),
      );

      it.effect(
        "reconciles a late installation after revocation and retries a failed removal",
        () =>
          Effect.gen(function* () {
            const { client, session, repository, organizationId } = yield* setupSessionCustody(
              owner,
              custody,
            );
            const params = { sessionKeyId: session.id };
            const installation = session.installations[0];
            if (!installation) return yield* Effect.die("Missing fixture installation");
            const prepare = (kind: "install" | "uninstall") =>
              prepareCustodyOperation(client, owner, {
                installationId: installation.id,
                kind,
                sponsor: false,
                idempotencyKey: crypto.randomUUID(),
              });
            const installed = yield* prepare("install");
            yield* installed.approve;
            expect((yield* client.sessionKey.revoke({ params })).status).toBe("revoking");
            const app = yield* Application;
            const chain = yield* TestEvmExecution;
            yield* chain.setReceiptMode("immediate");
            yield* TestClock.adjust(Duration.seconds(2));
            yield* app.sessionKey.reconcileOperations();
            const late = yield* client.sessionKey.get({ params });
            expect(late.status).toBe("revoking");
            expect(late.installations.find(({ id }) => id === installation.id)?.status).toBe(
              "installed",
            );
            expect(
              yield* client.apiKey
                .create({
                  payload: {
                    metadata: { version: 1, name: "Cannot restore revoked access" },
                    durationDays: 1,
                    sessionKeyIds: [session.id],
                  },
                })
                .pipe(Effect.flip),
            ).toMatchObject({ code: "SESSION_KEY_NOT_ACTIVE" });
            const failed = yield* prepare("uninstall");
            yield* failed.approve;
            yield* chain.setReceiptMode("failed");
            yield* TestClock.adjust(Duration.seconds(2));
            yield* app.sessionKey.reconcileOperations();
            expect((yield* client.sessionKey.get({ params })).status).toBe("revoking");
            const retry = yield* prepare("uninstall");
            expect(retry.prepared.operationId).not.toBe(failed.prepared.operationId);
            yield* retry.approve;
            yield* chain.setReceiptMode("immediate");
            yield* TestClock.adjust(Duration.seconds(2));
            yield* app.sessionKey.reconcileOperations();
            expect((yield* client.sessionKey.get({ params })).status).toBe("revoked");
            const audits = yield* repository.audit.organization.findForOrganization(organizationId);
            expect(audits.filter(({ event }) => event === "session_key.revoked")).toHaveLength(1);
          }),
      );
    });
  }
}
