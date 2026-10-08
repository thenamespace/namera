import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";

import { resetTestState } from "../../fixtures/api.js";
import { handledApi } from "../../fixtures/http-api-test.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

layer(TestServerLayer)("platform session authorization", (it) => {
  it.effect("accepts a verified human session independently of organization membership", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const owner = yield* platformIdentity();
      expect((yield* owner.client.platform.me()).member.role).toBe("owner");
      expect(
        (yield* owner.client.session.currentActor({ responseMode: "response-only" })).status,
      ).toBe(401);
      for (const headers of [
        {},
        { authorization: `Bearer ${owner.token}` },
        { "x-api-key": owner.token },
        { cookie: "auth-token=wrong" },
      ]) {
        const client = yield* handledApi(NameraApi, { headers });
        expect((yield* client.platform.me({ responseMode: "response-only" })).status).toBe(401);
      }
    }),
  );

  it.effect("enforces role permissions and applies suspension immediately", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const owner = yield* platformIdentity();
      const viewer = yield* platformIdentity("viewer@example.com", "viewer");
      const operator = yield* platformIdentity("operator@example.com", "operator");
      expect((yield* viewer.client.platform.me()).member.role).toBe("viewer");
      expect(
        (yield* viewer.client.platform.members({
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      expect((yield* operator.client.platform.me()).member.role).toBe("operator");
      expect(
        (yield* operator.client.platform.members({ responseMode: "response-only" })).status,
      ).toBe(403);
      yield* owner.client.platform.changeStatus({
        params: { id: operator.member.id },
        payload: { status: "suspended" },
      });
      expect((yield* operator.client.platform.me({ responseMode: "response-only" })).status).toBe(
        403,
      );
      yield* owner.client.platform.changeStatus({
        params: { id: operator.member.id },
        payload: { status: "active" },
      });
      expect((yield* operator.client.platform.me()).member.status).toBe("active");
      const repository = yield* Repository;
      yield* repository.auth.session.revoke(owner.session.id, owner.user.id, yield* DateTime.now);
      expect((yield* owner.client.platform.me({ responseMode: "response-only" })).status).toBe(401);
    }),
  );

  it.effect("requires an approved Origin for writes and recent login for team changes", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* TestClock.setTime(Date.now());
      const owner = yield* platformIdentity();
      const viewer = yield* platformIdentity("origin-viewer@example.com", "viewer");
      for (const origin of [undefined, "https://evil.test"]) {
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: owner.headers.cookie, ...(origin ? { origin } : {}) },
        });
        expect(
          (yield* client.platform.changeStatus({
            params: { id: viewer.member.id },
            payload: { status: "suspended" },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
      }
      yield* TestClock.adjust("11 minutes");
      expect(
        (yield* owner.client.platform.removeMember({
          params: { id: viewer.member.id },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      expect((yield* owner.client.platform.me()).member.role).toBe("owner");
    }),
  );

  it.effect("rate limits invalid session attempts", () =>
    Effect.gen(function* () {
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: "auth-token=wrong" },
        remoteAddress: "192.0.2.200",
      });
      for (let i = 0; i < 60; i++)
        expect((yield* client.platform.me({ responseMode: "response-only" })).status).toBe(401);
      expect((yield* client.platform.me({ responseMode: "response-only" })).status).toBe(429);
      yield* TestClock.adjust("1 minute");
      expect((yield* client.platform.me({ responseMode: "response-only" })).status).toBe(401);
    }),
  );
});
