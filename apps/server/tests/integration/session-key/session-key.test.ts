import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import {
  createMember,
  makeTestApiClient,
  missingSessionKeyId,
  missingWalletId,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestEmails } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { createTestManagedWallet } from "../../fixtures/managed-wallet.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const metadata = (name: string) => ({ version: 1 as const, name });

layer(fixture.layer)("session-key routes", (it) => {
  it.effect("creates and reads time-window session keys with durable side effects", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("session-key-owner@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Treasury");
      const now = yield* DateTime.now;
      const expiresAt = DateTime.addDuration(now, Duration.hours(1));
      const request = {
        ...(yield* localSessionRequest(wallet.id)),
        metadata: metadata("Agent window"),
        policies: [
          {
            type: "evm.time-window" as const,
            version: 1 as const,
            startsAt: null,
            expiresAt,
          },
          {
            type: "evm.signature" as const,
            version: 1 as const,
            allowedTypes: ["message" as const],
          },
          {
            type: "evm.chain-allowlist" as const,
            version: 1 as const,
            chainIds: ["eip155:1" as const, "eip155:8453" as const],
          },
          {
            type: "evm.gas-budget" as const,
            version: 1 as const,
            budgets: [
              {
                chainId: "eip155:1" as const,
                period: "day" as const,
                maxCost: 10_000_000_000_000_000n,
              },
            ],
          },
        ],
      };

      const created = yield* client.sessionKey.create({ payload: request });
      const duplicate = yield* client.sessionKey.create({
        payload: {
          ...request,
          signer: (yield* localSessionRequest(wallet.id)).signer,
          policies: request.policies.toReversed(),
          onchain: { ...request.onchain, allowSignatures: true },
        },
      });

      expect(created).toMatchObject({
        organizationId: owner.actor.organization.id,
        walletId: wallet.id,
        namespace: "eip155",
        status: "pending",
        metadata: metadata("Agent window"),
        wallet: {
          id: wallet.id,
          metadata: metadata("Treasury"),
        },
        creator: {
          organizationMember: {
            id: owner.actor.member.organizationMember.id,
          },
          user: {
            id: owner.actor.user.id,
          },
        },
        policies: [
          { type: "evm.time-window", version: 1, startsAt: null },
          { type: "evm.signature", version: 1, allowedTypes: ["message"] },
          {
            type: "evm.chain-allowlist",
            version: 1,
            chainIds: ["eip155:1", "eip155:8453"],
          },
          {
            type: "evm.gas-budget",
            version: 1,
            budgets: [
              {
                chainId: "eip155:1",
                period: "day",
                maxCost: 10_000_000_000_000_000n,
              },
            ],
          },
        ],
      });
      expect(created.policies[0]?.id).toBeDefined();
      expect(created.policyHash).toBe(duplicate.policyHash);
      // API signature policy does not imply onchain signature authority.
      expect(created.installations[0]?.authorization.allowSignatures).toBe(false);
      expect(duplicate.installations[0]?.authorization.allowSignatures).toBe(true);
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: created.id } })).id).toBe(
        created.id,
      );
      expect(
        (yield* client.sessionKey.listForWallet({ params: { walletId: wallet.id } })).map(
          (sessionKey) => sessionKey.id,
        ),
      ).toEqual([duplicate.id, created.id]);
      expect((yield* client.sessionKey.listForOrganization()).map(({ id }) => id)).toEqual([
        duplicate.id,
        created.id,
      ]);

      const repository = yield* Repository;
      expect(
        (yield* repository.audit.organization.findForOrganization(owner.actor.organization.id))
          .filter(({ event }) => event === "session_key.created")
          .map(({ resourceId }) => resourceId),
      ).toEqual(expect.arrayContaining([created.id, duplicate.id]));
      expect(
        (yield* client.notification.list({ query: {} })).items.filter(
          ({ notification }) => notification.type === "session_key.created",
        ),
      ).toHaveLength(2);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:session_key.created:${created.id}:${owner.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "session-key-created", status: "pending" });

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast(
        (email) =>
          email.type === "session-key-created" && email.variables.sessionKeyName === "Agent window",
      );
      for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast(
          (email) =>
            email.type === "session-key-created" &&
            email.variables.sessionKeyName === "Agent window",
        );
      }
      expect(delivered?.variables).toMatchObject({
        sessionKeyName: "Agent window",
        walletName: "Treasury",
        organizationName: owner.actor.organization.metadata.name,
      });
    }),
  );

  it.effect("rejects repeated singleton policies", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-policy-limits@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Policy limits");
      const now = yield* DateTime.now;
      const timeWindow = {
        type: "evm.time-window" as const,
        version: 1 as const,
        startsAt: null,
        expiresAt: DateTime.addDuration(now, Duration.days(1)),
      };

      expect(
        yield* client.sessionKey
          .create({
            payload: {
              ...(yield* localSessionRequest(wallet.id)),
              metadata: metadata("Repeated policy"),
              policies: [timeWindow, timeWindow],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({
        _tag: "SessionKeyCreationError",
        code: "POLICY_CARDINALITY_EXCEEDED",
      });

      expect(yield* client.sessionKey.listForOrganization()).toEqual([]);
    }),
  );

  it.effect("enforces session-key permissions and organization isolation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("session-key-reader@example.com"));
      yield* setAuthToken(member.ownerToken);
      const wallet = yield* createTestPasskeyWallet(client, "Operations");
      const created = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Read only"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
          ],
        },
      });

      yield* setAuthToken(member.memberToken);
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: created.id } })).id).toBe(
        created.id,
      );
      expect(yield* client.sessionKey.listForOrganization()).toHaveLength(1);
      expect(
        yield* client.sessionKey
          .create({
            payload: {
              ...(yield* localSessionRequest(wallet.id)),
              metadata: metadata("Forbidden"),
              policies: [
                {
                  type: "evm.time-window",
                  version: 1,
                  startsAt: null,
                  expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
                },
              ],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      yield* signIn(client, testEmail("session-key-other@example.com"));
      expect(
        yield* client.sessionKey.get({ params: { sessionKeyId: created.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
      expect(
        yield* client.sessionKey
          .listForWallet({ params: { walletId: missingWalletId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
      expect(
        yield* client.sessionKey
          .get({ params: { sessionKeyId: missingSessionKeyId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
    }),
  );

  it.effect("scopes API-key reads to active session-key grants", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-api-reader@example.com"));
      const expiresAt = DateTime.addDuration(yield* DateTime.now, Duration.days(1));
      const grantedWallet = yield* createTestPasskeyWallet(client, "Granted wallet");
      const hiddenWallet = yield* createTestManagedWallet(client, {
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", protectionLevel: "software" },
          metadata: metadata("Hidden wallet"),
        },
      });
      const grantedSessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(grantedWallet.id)),
          metadata: metadata("Granted key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt,
            },
          ],
        },
      });
      const hiddenSessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(grantedWallet.id)),
          metadata: metadata("Hidden key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt,
            },
          ],
        },
      });
      expect((yield* fixture.confirmOperation(client, grantedSessionKey, "install")).status).toBe(
        "active",
      );
      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Scoped reader"),
          durationDays: 7,
          sessionKeyIds: [grantedSessionKey.id],
        },
      });

      yield* setAuthToken();
      yield* setApiKey(apiKey.key);

      expect((yield* client.wallet.list()).map(({ id }) => id)).toEqual([grantedWallet.id]);
      expect((yield* client.sessionKey.listForOrganization()).map(({ id }) => id)).toEqual([
        grantedSessionKey.id,
      ]);
      expect(
        (yield* client.sessionKey.listForWallet({ params: { walletId: grantedWallet.id } })).map(
          ({ id }) => id,
        ),
      ).toEqual([grantedSessionKey.id]);
      expect(
        yield* client.wallet.get({ params: { walletId: hiddenWallet.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
      expect(
        yield* client.sessionKey
          .get({ params: { sessionKeyId: hiddenSessionKey.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
      expect(
        yield* client.sessionKey
          .listForWallet({ params: { walletId: hiddenWallet.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "WalletError", code: "WALLET_NOT_FOUND" });
    }),
  );

  it.effect("rejects expired time windows before persistence", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-expired@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Expired wallet");

      expect(
        yield* client.sessionKey
          .create({
            payload: {
              ...(yield* localSessionRequest(wallet.id)),
              metadata: metadata("Expired"),
              policies: [
                {
                  type: "evm.time-window",
                  version: 1,
                  startsAt: null,
                  expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.minutes(-1)),
                },
              ],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyCreationError", code: "TIME_WINDOW_EXPIRED" });
      expect(yield* client.sessionKey.listForOrganization()).toEqual([]);
    }),
  );

  it.effect("revokes a session key and every active grant exactly once", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("session-key-revoke@example.com"));
      const wallet = yield* createTestPasskeyWallet(client, "Revocation wallet");
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Revocable key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
          ],
        },
      });
      expect((yield* fixture.confirmOperation(client, sessionKey, "install")).status).toBe(
        "active",
      );
      const firstApiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("First agent"),
          durationDays: 30,
          sessionKeyIds: [sessionKey.id],
        },
      });
      const secondApiKey = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Second agent"),
          durationDays: 30,
          sessionKeyIds: [sessionKey.id],
        },
      });

      const requested = yield* client.sessionKey.revoke({
        params: { sessionKeyId: sessionKey.id },
      });
      expect(requested.status).toBe("revoking");
      const revoked = yield* fixture.confirmOperation(client, sessionKey, "uninstall");
      expect(revoked).toMatchObject({
        id: sessionKey.id,
        status: "revoked",
        revokedAt: expect.anything(),
      });
      expect(
        yield* client.sessionKey.get({ params: { sessionKeyId: sessionKey.id } }),
      ).toMatchObject({ status: "revoked" });

      const repository = yield* Repository;
      expect(
        yield* repository.core.sessionKeyGrant.findActiveForActor(
          owner.actor.organization.id,
          firstApiKey.apiKey.actorId,
        ),
      ).toEqual([]);
      expect(
        yield* repository.core.sessionKeyGrant.findActiveForActor(
          owner.actor.organization.id,
          secondApiKey.apiKey.actorId,
        ),
      ).toEqual([]);
      const events = (yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      )).filter(
        ({ event, resourceId }) => event === "session_key.revoked" && resourceId === sessionKey.id,
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toMatchObject({ revokedGrantCount: 2 });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) =>
            notification.type === "session_key.revoked" &&
            notification.resourceId === sessionKey.id &&
            notification.data.revokedGrantCount === 2,
        ),
      ).toBe(true);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:session_key.revoked:${sessionKey.id}:${owner.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "session-key-revoked", status: "pending" });

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast(
        (email) => email.type === "session-key-revoked",
      );
      for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast((email) => email.type === "session-key-revoked");
      }
      expect(delivered?.variables).toMatchObject({
        sessionKeyName: "Revocable key",
        walletName: "Revocation wallet",
        revokedGrantCount: 2,
      });

      const repeated = yield* client.sessionKey.revoke({
        params: { sessionKeyId: sessionKey.id },
      });
      expect(repeated.revokedAt).toEqual(revoked.revokedAt);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).filter(
          ({ event, resourceId }) =>
            event === "session_key.revoked" && resourceId === sessionKey.id,
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("enforces session-key revocation permission and organization scope", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-revoke-owner@example.com"));
      const member = yield* createMember(
        client,
        testEmail("session-key-revoke-member@example.com"),
      );
      yield* setAuthToken(member.ownerToken);
      const wallet = yield* createTestPasskeyWallet(client, "Permission wallet");
      const sessionKey = yield* client.sessionKey.create({
        payload: {
          ...(yield* localSessionRequest(wallet.id)),
          metadata: metadata("Permission key"),
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.days(1)),
            },
          ],
        },
      });

      yield* setAuthToken(member.memberToken);
      expect(
        yield* client.sessionKey
          .revoke({ params: { sessionKeyId: sessionKey.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      yield* signIn(client, testEmail("session-key-revoke-other@example.com"));
      expect(
        yield* client.sessionKey
          .revoke({ params: { sessionKeyId: sessionKey.id } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
      expect(
        yield* client.sessionKey
          .revoke({ params: { sessionKeyId: missingSessionKeyId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
    }),
  );
});
