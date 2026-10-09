import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Result } from "effect";

import { Database, DatabaseMigration, Repository } from "@namera-ai/database";

import { bootstrapConfiguredAdminOwner } from "#/layers/admin-bootstrap";

import { resetTestState, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const runBootstrap = (email?: string) =>
  bootstrapConfiguredAdminOwner().pipe(
    Effect.provideService(DatabaseMigration, { completed: true }),
    Effect.provide(
      makeTestConfigLayer(email === undefined ? {} : { ADMIN_BOOTSTRAP_OWNER_EMAIL: email }),
    ),
  );

layer(TestServerLayer)("configured admin bootstrap", (it) => {
  it.effect("does nothing when configuration is absent or blank", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* runBootstrap();
      yield* runBootstrap("");
      yield* runBootstrap("   ");
      expect(yield* (yield* Repository).auth.platform.listMembers()).toEqual([]);
    }),
  );

  it.effect("skips missing and unverified users, then retries after verification", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const repository = yield* Repository;
      const email = testEmail("bootstrap@example.com");
      yield* runBootstrap(email);
      expect(yield* repository.auth.user.findByEmail(email)).toBeUndefined();
      const user = yield* repository.auth.user.create({ email, metadata: { version: 1 } });
      yield* runBootstrap(email);
      expect(yield* repository.auth.platform.listMembers()).toEqual([]);
      const db = yield* Database;
      expect(yield* db.query.platformEvent.findMany()).toHaveLength(0);
      yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, yield* DateTime.now);
      yield* runBootstrap(email);
      yield* runBootstrap(email);
      expect(yield* repository.auth.platform.findOwner()).toMatchObject({
        userId: user.id,
        role: "owner",
        status: "active",
      });
      const events = yield* db.query.platformEvent.findMany();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorMemberId: null });
    }),
  );

  it.effect("never replaces an existing owner when the configured email changes", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const owner = yield* platformIdentity();
      const repository = yield* Repository;
      const email = testEmail("different-owner@example.com");
      const user = yield* repository.auth.user.create({ email, metadata: { version: 1 } });
      yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, yield* DateTime.now);
      yield* runBootstrap(email);
      expect((yield* repository.auth.platform.findOwner())?.id).toBe(owner.member.id);
      expect(yield* repository.auth.platform.findMember(user.id)).toBeUndefined();
      expect(yield* (yield* Database).query.platformEvent.findMany()).toHaveLength(1);
    }),
  );

  it.effect("concurrent startups create only one owner and audit event", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const repository = yield* Repository;
      const emails = [testEmail("first@example.com"), testEmail("second@example.com")];
      for (const email of emails) {
        const user = yield* repository.auth.user.create({ email, metadata: { version: 1 } });
        yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, yield* DateTime.now);
      }
      yield* Effect.all(emails.map(runBootstrap), { concurrency: "unbounded" });
      expect(yield* repository.auth.platform.listMembers()).toHaveLength(1);
      expect(yield* (yield* Database).query.platformEvent.findMany()).toHaveLength(1);
    }),
  );

  it.effect("rejects malformed configuration without creating membership", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      expect(Result.isFailure(yield* runBootstrap("not-an-email").pipe(Effect.result))).toBe(true);
      expect(yield* (yield* Repository).auth.platform.listMembers()).toEqual([]);
    }),
  );
});
