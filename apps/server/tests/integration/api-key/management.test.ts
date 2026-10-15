import { expect, it as test, layer } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { createTestAuthenticator } from "@namera-ai/passkeys/testing";
import { Hex } from "@namera-ai/protocol";
import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { ApiKeyPermission, CustomOrganizationRoleInsert } from "@namera-ai/protocol/model";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  setAuthToken,
  setApiKey,
  signIn,
  testEmail,
  type TestApiClient,
} from "../../fixtures/index.js";
import { localSessionRequest } from "../../fixtures/local-session.js";
import { managedSessionLayer } from "../../fixtures/managed-session.js";
import { setupSessionCustody } from "../../fixtures/session-custody.js";

const firstInstallation = (session: SessionKeyResponse) => {
  const installation = session.installations[0];
  if (installation === undefined) throw new Error("Expected a fixture installation");
  return installation;
};

const issue = (
  client: TestApiClient,
  permissions: readonly ApiKeyPermission[] = ApiKeyPermission.literals,
  passkeyOrigins: readonly string[] = [],
) =>
  client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Workspace backend" },
      durationDays: 30,
      sessionKeyIds: [],
      permissions,
      passkeyOrigins,
    },
  });

layer(managedSessionLayer())("API-key wallet administration", (it) => {
  it.effect("manages existing and future accounts with explicit workspace permissions", () =>
    Effect.gen(function* () {
      const f = yield* setupSessionCustody("1claw", "local");
      const key = yield* issue(f.client);
      yield* setApiKey(key.key);
      expect((yield* f.client.wallet.list()).map(({ id }) => id)).toContain(f.wallet.id);
      const request = {
        namespace: "eip155" as const,
        owner: { type: "namera-managed" as const, provider: "1claw" as const },
        metadata: { version: 1 as const, name: "Provisioned account" },
        idempotencyKey: crypto.randomUUID(),
      };
      const wallet = yield* f.client.wallet.create({ payload: request });
      expect((yield* f.client.wallet.create({ payload: request })).id).toBe(wallet.id);
      for (const custody of ["local", "namera-managed"] as const) {
        const local = yield* localSessionRequest(wallet.id, ["eip155:11155111"]);
        const payload =
          custody === "local"
            ? local
            : {
                ...local,
                idempotencyKey: crypto.randomUUID(),
                signer: { custody, provider: "1claw" as const, algorithm: "secp256k1" as const },
              };
        const session = yield* f.client.sessionKey.create({ payload });
        expect(session.creator).toMatchObject({ type: "api-key", actorId: key.apiKey.actorId });
        expect(session.status).toBe("pending");
        const db = yield* Database;
        expect(
          yield* db.query.sessionKeyGrant.findMany({
            where: { actorId: { eq: key.apiKey.actorId }, sessionKeyId: { eq: session.id } },
          }),
        ).toEqual([expect.objectContaining({ revokedAt: null })]);

        if (custody === "namera-managed")
          expect((yield* f.client.sessionKey.create({ payload })).id).toBe(session.id);
      }
      const installation = firstInstallation(f.session);
      const prepared = yield* f.client.sessionKey.prepareManagedOperation({
        payload: {
          installationId: installation.id,
          kind: "install",
          sponsor: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      expect(
        (yield* f.client.sessionKey.getActiveOperation({
          params: { installationId: installation.id, kind: "install" },
        })).operation?.retryRequest,
      ).not.toBeNull();
      yield* f.client.sessionKey.approveManagedOperation({
        payload: { operationId: prepared.operationId },
      });
      expect(
        (yield* f.client.sessionKey.get({ params: { sessionKeyId: f.session.id } })).status,
      ).toBe("pending");
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).sessionKey.reconcileOperations();
      expect(
        (yield* f.client.sessionKey.getOperation({ params: { operationId: prepared.operationId } }))
          .status,
      ).toBe("confirmed");
      // Administration alone does not create an execution grant to an existing session.
      expect(
        (yield* f.repository.core.sessionKeyGrant.findActiveForActor(
          f.organizationId,
          key.apiKey.actorId,
        )).some(({ sessionKey }) => sessionKey.id === f.session.id),
      ).toBe(false);
      const removal = yield* f.client.sessionKey.prepareManagedOperation({
        payload: {
          installationId: installation.id,
          kind: "uninstall",
          sponsor: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      yield* f.client.sessionKey.approveManagedOperation({
        payload: { operationId: removal.operationId },
      });
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).sessionKey.reconcileOperations();
      expect(
        (yield* f.client.sessionKey.get({ params: { sessionKeyId: f.session.id } }))
          .installations[0]?.status,
      ).toBe("revoked");
      yield* f.client.sessionKey.revoke({ params: { sessionKeyId: f.session.id } });
    }),
  );

  it.effect("does not let issuers delegate management authority they do not hold", () =>
    Effect.gen(function* () {
      const f = yield* setupSessionCustody("1claw", "local");
      const member = yield* createMember(f.client, testEmail("key-issuer@example.com"), "admin");
      const role = yield* f.repository.auth.role.insert(
        Schema.decodeUnknownSync(CustomOrganizationRoleInsert)({
          organizationId: f.organizationId,
          key: "api-issuer",
          metadata: { version: 1, name: "API issuer" },
          permissions: ["api-key:create", "wallet:read"],
        }),
      );
      yield* f.repository.auth.member.assignRole(
        member.actor.member.organizationMember.id,
        f.organizationId,
        member.actor.role.id,
        role.id,
      );
      yield* setAuthToken(member.memberToken);
      expect(yield* issue(f.client, ["session-key:install"]).pipe(Effect.flip)).toMatchObject({
        code: "PERMISSION_DENIED",
      });
      expect((yield* issue(f.client, ["wallet:read"])).apiKey.permissions).toEqual(["wallet:read"]);
    }),
  );

  it.effect("leaves execution-only keys without management permissions or workspace reads", () =>
    Effect.gen(function* () {
      const f = yield* setupSessionCustody("1claw", "local");
      const prepared = yield* f.client.sessionKey.prepareManagedOperation({
        payload: {
          installationId: firstInstallation(f.session).id,
          kind: "install",
          sponsor: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      yield* f.client.sessionKey.approveManagedOperation({
        payload: { operationId: prepared.operationId },
      });
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).sessionKey.reconcileOperations();
      const key = yield* f.client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Execution only" },
          durationDays: 30,
          sessionKeyIds: [f.session.id],
        },
      });
      expect(key.apiKey.permissions).toEqual([]);
      yield* setApiKey(key.key);
      expect(
        yield* f.client.wallet
          .create({
            payload: {
              namespace: "eip155",
              metadata: { version: 1, name: "Denied" },
              owner: { type: "namera-managed", provider: "1claw" },
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      expect(
        yield* f.client.sessionKey
          .revoke({ params: { sessionKeyId: f.session.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("keeps permissions independent and operations bound to the initiating actor", () =>
    Effect.gen(function* () {
      const f = yield* setupSessionCustody("1claw", "local");
      const reader = yield* issue(f.client, ["wallet:read", "session-key:read"]);
      const installer = yield* issue(f.client, ["session-key:read", "session-key:install"]);
      yield* setApiKey(reader.key);
      expect(
        yield* f.client.sessionKey
          .create({ payload: yield* localSessionRequest(f.wallet.id) })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      const payload = {
        installationId: firstInstallation(f.session).id,
        kind: "install" as const,
        sponsor: true,
        idempotencyKey: crypto.randomUUID(),
      };
      expect(
        yield* f.client.sessionKey.prepareManagedOperation({ payload }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      yield* setApiKey(installer.key);
      const operation = yield* f.client.sessionKey.prepareManagedOperation({ payload });
      yield* setApiKey(reader.key);
      expect(
        yield* f.client.sessionKey
          .approveManagedOperation({ payload: { operationId: operation.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      expect(
        yield* f.client.sessionKey
          .getOperation({ params: { operationId: operation.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      yield* setApiKey();
      const stranger = yield* signIn(f.client, testEmail("management-other-org@example.com"));
      const otherKey = yield* issue(f.client);
      yield* setApiKey(otherKey.key);
      expect(
        yield* f.client.sessionKey.prepareManagedOperation({ payload }).pipe(Effect.flip),
      ).toMatchObject({ code: "INSTALLATION_UNAVAILABLE" });
      expect(stranger.actor.organization.id).not.toBe(f.organizationId);
    }),
  );
});

const authenticator = createTestAuthenticator();
const execution = makeTestEvmExecutionService();
layer(
  managedSessionLayer(
    {
      ownerApprovalChallenge: () => Effect.succeed(Hex.make(`0x${"11".repeat(32)}`)),
      completeOwnerApproval: execution.sign,
    },
    authenticator.layer,
  ),
)("API-key passkey ceremonies", (it) => {
  it.effect(
    "binds registration to its actor and approved origin, then requires a valid owner assertion",
    () =>
      Effect.gen(function* () {
        const f = yield* setupSessionCustody("1claw", "local");
        const key = yield* issue(f.client, ApiKeyPermission.literals, ["https://app.example.com"]);
        const other = yield* issue(f.client, ApiKeyPermission.literals, [
          "https://app.example.com",
        ]);
        yield* setApiKey(key.key);
        const registrationRequest = {
          origin: "https://app.example.com",
          user: { name: "Customer", displayName: "Customer" },
        };
        expect(
          yield* f.client.wallet
            .createPasskeyRegistrationOptions({
              payload: { ...registrationRequest, origin: "https://evil.example" },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "MANAGEMENT_PERMISSION_DENIED" });
        const registration = yield* f.client.wallet.createPasskeyRegistrationOptions({
          payload: registrationRequest,
        });
        const walletRequest = {
          namespace: "eip155" as const,
          metadata: { version: 1 as const, name: "Customer account" },
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
        };
        yield* setApiKey(other.key);
        expect(
          yield* f.client.wallet.create({ payload: walletRequest }).pipe(Effect.flip),
        ).toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
        yield* setApiKey(key.key);
        const wallet = yield* f.client.wallet.create({ payload: walletRequest });
        expect(
          yield* f.client.wallet.create({ payload: walletRequest }).pipe(Effect.flip),
        ).toMatchObject({ code: "REGISTRATION_NOT_FOUND" });
        const session = yield* f.client.sessionKey.create({
          payload: yield* localSessionRequest(wallet.id, ["eip155:11155111"]),
        });
        const preparation = yield* f.client.sessionKey.prepareOperation({
          payload: {
            installationId: firstInstallation(session).id,
            kind: "install",
            sponsor: true,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        const assertion = (origin: string) =>
          authenticator.authenticate({
            challenge: preparation.options.challenge,
            rpId: "app.example.com",
            origin,
          });
        expect(
          yield* f.client.sessionKey
            .completeOperation({
              payload: {
                operationId: preparation.operationId,
                response: assertion("https://evil.example"),
              },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        expect(
          yield* f.client.sessionKey.completeOperation({
            payload: {
              operationId: preparation.operationId,
              response: assertion("https://app.example.com"),
            },
          }),
        ).toMatchObject({ status: "signed" });
      }),
  );
});

test.effect("rejects managed approval if its API key is revoked during signing", () =>
  Effect.gen(function* () {
    const signing = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const managed = makeTestEvmExecutionService({}, { signWithOwner: true });
    yield* Effect.gen(function* () {
      const f = yield* setupSessionCustody("1claw", "local");
      const key = yield* issue(f.client);
      const owner = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${f.actor.cookie.value}`, origin: "http://dashboard.test" },
      });
      yield* setApiKey(key.key);
      const prepared = yield* f.client.sessionKey.prepareManagedOperation({
        payload: {
          installationId: firstInstallation(f.session).id,
          kind: "install",
          sponsor: true,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const approval = yield* Effect.forkChild(
        f.client.sessionKey
          .approveManagedOperation({ payload: { operationId: prepared.operationId } })
          .pipe(Effect.result),
      );
      yield* Deferred.await(signing);
      yield* owner.apiKey.revoke({ params: { apiKeyId: key.apiKey.id } });
      yield* Deferred.succeed(release, undefined);
      expect(yield* Fiber.join(approval)).toMatchObject({
        _tag: "Failure",
        failure: { code: "OPERATION_UNAVAILABLE" },
      });
      expect(
        (yield* f.repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId: f.organizationId,
        }))?.data.signed,
      ).toBeNull();
      expect(
        yield* f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "session-key-operation",
          prepared.operationId,
        ),
      ).toEqual([]);
      expect(yield* Ref.get(f.control.calls)).toContain("signing.signDigest");
    }).pipe(
      Effect.provide(
        managedSessionLayer({
          sign: (input) =>
            managed.sign(input).pipe(
              Effect.tap(() => Deferred.succeed(signing, undefined)),
              Effect.tap(() => Deferred.await(release)),
            ),
        }),
      ),
    );
  }),
);
