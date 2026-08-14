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
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

const metadata = (name: string) => ({ version: 1 as const, name });

layer(TestServerLayer)("session-key routes", (it) => {
  it.effect("creates and reads time-window session keys with durable side effects", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("session-key-owner@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Treasury"),
        },
      });
      const now = yield* DateTime.now;
      const expiresAt = DateTime.addDuration(now, Duration.hours(1));
      const request = {
        namespace: "eip155" as const,
        walletId: wallet.id,
        metadata: metadata("Agent window"),
        policies: [
          {
            type: "evm.time-window" as const,
            version: 1 as const,
            startsAt: null,
            expiresAt,
          },
          {
            type: "evm.time-window" as const,
            version: 1 as const,
            startsAt: DateTime.addDuration(now, Duration.minutes(5)),
            expiresAt: DateTime.addDuration(now, Duration.hours(2)),
          },
        ],
      };

      const created = yield* client.sessionKey.create({ payload: request });
      const duplicate = yield* client.sessionKey.create({
        payload: { ...request, policies: request.policies.toReversed() },
      });

      expect(created).toMatchObject({
        organizationId: owner.actor.organization.id,
        walletId: wallet.id,
        namespace: "eip155",
        status: "active",
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
          { type: "evm.time-window", version: 1 },
        ],
      });
      expect(created.policies[0]?.id).toBeDefined();
      expect(created.policyHash).toBe(duplicate.policyHash);
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

  it.effect("enforces session-key permissions and organization isolation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("session-key-reader@example.com"));
      yield* setAuthToken(member.ownerToken);
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "safe",
          protectionLevel: "software",
          metadata: metadata("Operations"),
        },
      });
      const created = yield* client.sessionKey.create({
        payload: {
          namespace: "eip155",
          walletId: wallet.id,
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
              namespace: "eip155",
              walletId: wallet.id,
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

  it.effect("rejects expired time windows before persistence", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("session-key-expired@example.com"));
      const wallet = yield* client.wallet.create({
        payload: {
          namespace: "eip155",
          implementation: "kernel",
          protectionLevel: "software",
          metadata: metadata("Expired wallet"),
        },
      });

      expect(
        yield* client.sessionKey
          .create({
            payload: {
              namespace: "eip155",
              walletId: wallet.id,
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
});
