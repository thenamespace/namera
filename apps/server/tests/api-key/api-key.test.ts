import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import {
  createMember,
  makeTestApiClient,
  missingApiKeyId,
  missingSessionKeyId,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
  type TestApiClient,
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

const createSessionKey = Effect.fn("server.test.createApiKeySessionKey")(function* (
  client: TestApiClient,
  name: string,
) {
  const wallet = yield* client.wallet.create({
    payload: {
      namespace: "eip155",
      protectionLevel: "software",
      metadata: metadata(`${name} wallet`),
    },
  });
  return yield* client.sessionKey.create({
    payload: {
      namespace: "eip155",
      walletId: wallet.id,
      metadata: metadata(name),
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
});

layer(TestServerLayer)("API-key routes", (it) => {
  it.effect("creates, lists, and reads API keys with grants and durable side effects", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("api-key-owner@example.com"));
      const firstSessionKey = yield* createSessionKey(client, "Treasury agent");
      const secondSessionKey = yield* createSessionKey(client, "Operations agent");
      const now = yield* DateTime.now;

      const created = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Production agent"),
          durationDays: 30,
          sessionKeyIds: [firstSessionKey.id, secondSessionKey.id],
        },
      });

      expect(created.key.startsWith("namera_")).toBe(true);
      expect(created.apiKey).toMatchObject({
        organizationId: owner.actor.organization.id,
        metadata: metadata("Production agent"),
        revokedAt: null,
        lastUsedAt: null,
      });
      const apiKeyExpiresAt = created.apiKey.expiresAt;
      if (apiKeyExpiresAt === null) return yield* Effect.die("Created API key did not expire");
      expect(DateTime.toEpochMillis(apiKeyExpiresAt) - DateTime.toEpochMillis(now)).toBe(
        Duration.toMillis(Duration.days(30)),
      );
      expect(created.apiKey.sessionKeys.map(({ id }) => id)).toEqual([
        firstSessionKey.id,
        secondSessionKey.id,
      ]);
      expect(created.apiKey.creator.user.email).toBe(owner.actor.user.email);
      const fetched = yield* client.apiKey.get({ params: { apiKeyId: created.apiKey.id } });
      expect(fetched.sessionKeys.map(({ id }) => id)).toEqual(
        expect.arrayContaining([firstSessionKey.id, secondSessionKey.id]),
      );
      expect(fetched.creator.organizationMember.id).toBe(
        created.apiKey.creator.organizationMember.id,
      );
      const listed = yield* client.apiKey.list();
      expect(listed.map(({ id }) => id)).toEqual([created.apiKey.id]);
      expect(listed[0]?.creator.user.email).toBe(owner.actor.user.email);

      const repository = yield* Repository;
      const stored = yield* repository.auth.apiKey.findById(
        created.apiKey.id,
        owner.actor.organization.id,
      );
      const crypto = yield* CryptoService;
      expect(stored?.keyHash).toBe(
        yield* crypto.hash({ purpose: cryptoPurpose.apiKey, value: created.key }),
      );
      expect(stored?.keyHash).not.toBe(created.key);
      expect(stored?.keyStart).toBe(created.key.slice(0, 14));
      expect(
        yield* repository.core.sessionKeyGrant.findActiveForActor(
          owner.actor.organization.id,
          created.apiKey.actorId,
        ),
      ).toHaveLength(2);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).find(
          ({ event, resourceId }) =>
            event === "api_key.created" && resourceId === created.apiKey.id,
        )?.data,
      ).toMatchObject({
        version: 1,
        sessionKeyIds: [firstSessionKey.id, secondSessionKey.id],
      });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) =>
            notification.type === "api_key.created" &&
            notification.resourceId === created.apiKey.id,
        ),
      ).toBe(true);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:api_key.created:${created.apiKey.id}:${owner.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "api-key-created", status: "pending" });

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast((email) => email.type === "api-key-created");
      for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast((email) => email.type === "api-key-created");
      }
      expect(delivered?.variables).toMatchObject({
        apiKeyName: "Production agent",
        organizationName: owner.actor.organization.metadata.name,
        sessionKeyCount: 2,
      });
    }),
  );

  it.effect("enforces API-key permissions, validation, and organization isolation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("api-key-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("api-key-reader@example.com"));
      yield* setAuthToken(member.ownerToken);
      const sessionKey = yield* createSessionKey(client, "Permission key");
      const created = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Shared reader"),
          durationDays: 30,
          sessionKeyIds: [sessionKey.id],
        },
      });

      yield* setAuthToken(member.memberToken);
      expect((yield* client.apiKey.get({ params: { apiKeyId: created.apiKey.id } })).id).toBe(
        created.apiKey.id,
      );
      expect(yield* client.apiKey.list()).toHaveLength(1);
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) =>
            notification.type === "api_key.created" &&
            notification.resourceId === created.apiKey.id,
        ),
      ).toBe(true);
      expect(
        yield* client.apiKey
          .create({
            payload: {
              metadata: metadata("Forbidden"),
              durationDays: 30,
              sessionKeyIds: [sessionKey.id],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      yield* setAuthToken(member.ownerToken);
      expect(
        yield* client.apiKey
          .create({
            payload: {
              metadata: metadata("Missing grant"),
              durationDays: 30,
              sessionKeyIds: [missingSessionKeyId],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "SessionKeyError", code: "SESSION_KEY_NOT_FOUND" });
      yield* signIn(client, testEmail("api-key-other@example.com"));
      expect(yield* client.apiKey.list()).toEqual([]);
      expect(
        yield* client.apiKey.get({ params: { apiKeyId: created.apiKey.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "ApiKeyError", code: "API_KEY_NOT_FOUND" });
      expect(
        yield* client.apiKey.get({ params: { apiKeyId: missingApiKeyId } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "ApiKeyError", code: "API_KEY_NOT_FOUND" });
    }),
  );

  it.effect("honors API-key email preferences while retaining inbox delivery", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("api-key-preference@example.com"));
      yield* client.notification.updatePreference({
        payload: {
          organizationId: owner.actor.organization.id,
          category: "organization",
          topic: "api-keys",
          channel: "email",
          enabled: false,
        },
      });
      const sessionKey = yield* createSessionKey(client, "Preference key");
      const created = yield* client.apiKey.create({
        payload: {
          metadata: metadata("No email"),
          durationDays: 30,
          sessionKeyIds: [sessionKey.id],
        },
      });

      const repository = yield* Repository;
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:api_key.created:${created.apiKey.id}:${owner.actor.user.id}:email`,
        ),
      ).toBeUndefined();
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) => notification.resourceId === created.apiKey.id,
        ),
      ).toBe(true);
    }),
  );

  it.effect("revokes an API key and every active grant exactly once", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("api-key-revoke@example.com"));
      const firstSessionKey = yield* createSessionKey(client, "Treasury revoke key");
      const secondSessionKey = yield* createSessionKey(client, "Operations revoke key");
      const created = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Revocable agent"),
          durationDays: 30,
          sessionKeyIds: [firstSessionKey.id, secondSessionKey.id],
        },
      });

      const revoked = yield* client.apiKey.revoke({
        params: { apiKeyId: created.apiKey.id },
      });
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.sessionKeys).toEqual([]);

      const repository = yield* Repository;
      expect(
        yield* repository.core.sessionKeyGrant.findActiveForActor(
          owner.actor.organization.id,
          created.apiKey.actorId,
        ),
      ).toEqual([]);
      const crypto = yield* CryptoService;
      expect(
        yield* repository.auth.apiKey.authenticate(
          yield* crypto.hash({
            purpose: cryptoPurpose.apiKey,
            value: created.key,
          }),
          yield* DateTime.now,
        ),
      ).toBeUndefined();

      const events = (yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      )).filter(
        ({ event, resourceId }) => event === "api_key.revoked" && resourceId === created.apiKey.id,
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toMatchObject({
        version: 1,
        sessionKeyIds: expect.arrayContaining([firstSessionKey.id, secondSessionKey.id]),
      });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          ({ notification }) =>
            notification.type === "api_key.revoked" &&
            notification.resourceId === created.apiKey.id,
        ),
      ).toBe(true);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `notification:api_key.revoked:${created.apiKey.id}:${owner.actor.user.id}:email`,
        ),
      ).toMatchObject({ type: "api-key-revoked", status: "pending" });

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast((email) => email.type === "api-key-revoked");
      for (let attempt = 0; delivered === undefined && attempt < 10; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast((email) => email.type === "api-key-revoked");
      }
      expect(delivered?.variables).toMatchObject({
        apiKeyName: "Revocable agent",
        organizationName: owner.actor.organization.metadata.name,
        sessionKeyCount: 2,
      });

      const repeated = yield* client.apiKey.revoke({
        params: { apiKeyId: created.apiKey.id },
      });
      expect(repeated.revokedAt).toEqual(revoked.revokedAt);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).filter(
          ({ event, resourceId }) =>
            event === "api_key.revoked" && resourceId === created.apiKey.id,
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("enforces API-key revocation permission and organization scope", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("api-key-revoke-permission-owner@example.com"));
      const member = yield* createMember(
        client,
        testEmail("api-key-revoke-permission-member@example.com"),
      );
      yield* setAuthToken(member.ownerToken);
      const sessionKey = yield* createSessionKey(client, "Protected revoke key");
      const created = yield* client.apiKey.create({
        payload: {
          metadata: metadata("Protected agent"),
          durationDays: 30,
          sessionKeyIds: [sessionKey.id],
        },
      });

      yield* setAuthToken(member.memberToken);
      expect(
        yield* client.apiKey.revoke({ params: { apiKeyId: created.apiKey.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });

      yield* signIn(client, testEmail("api-key-revoke-other-organization@example.com"));
      expect(
        yield* client.apiKey.revoke({ params: { apiKeyId: created.apiKey.id } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "ApiKeyError", code: "API_KEY_NOT_FOUND" });
      expect(
        yield* client.apiKey.revoke({ params: { apiKeyId: missingApiKeyId } }).pipe(Effect.flip),
      ).toMatchObject({ _tag: "ApiKeyError", code: "API_KEY_NOT_FOUND" });
    }),
  );

  it.effect("rate limits repeated API-key creation for one organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("api-key-rate-limit@example.com"));
      const sessionKey = yield* createSessionKey(client, "Rate limit key");

      for (let index = 0; index < 20; index += 1) {
        yield* client.apiKey.create({
          payload: {
            metadata: metadata(`Agent ${index}`),
            durationDays: 7,
            sessionKeyIds: [sessionKey.id],
          },
        });
      }
      expect(
        yield* client.apiKey
          .create({
            payload: {
              metadata: metadata("Rate limited"),
              durationDays: 7,
              sessionKeyIds: [sessionKey.id],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "RateLimitExceeded" });
    }),
  );
});
