import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { NameraApi } from "@namera-ai/api";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

it.effect("logs out without a customer organization, enforces Origin and clears the session", () =>
  Effect.gen(function* () {
    yield* resetTestState();
    const owner = yield* platformIdentity();
    expect(owner.session.activeOrganizationId).toBeNull();
    const untrusted = yield* handledApi(NameraApi, {
      headers: { ...owner.headers, origin: "https://untrusted.example" },
    });
    expect(
      (yield* untrusted.platformSession.logout({ responseMode: "response-only" })).status,
    ).toBe(403);
    yield* owner.client.platform.me();
    // Revoked platform membership must not trap the user in a browser session.
    const viewer = yield* platformIdentity("viewer@example.com", "viewer");
    yield* owner.client.platform.changeStatus({
      params: { id: viewer.member.id },
      payload: { status: "suspended" },
    });
    yield* viewer.client.platformSession.logout({});
    expect(
      (yield* viewer.client.platformSession.logout({ responseMode: "response-only" })).status,
    ).toBe(401);
    const [, response] = yield* owner.client.platformSession.logout({
      responseMode: "decoded-and-response",
    });
    expect(response.cookies.cookies["auth-token"]?.value).toBe("");
    expect((yield* owner.client.platform.me({ responseMode: "response-only" })).status).toBe(401);
  }).pipe(Effect.provide(TestServerLayer)),
);
