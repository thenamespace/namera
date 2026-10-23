import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";

import { AuthConfig } from "../../../src/auth/config.js";

it.effect.each([
  { name: "open beta by default", env: {}, inviteRequired: false },
  { name: "explicit open beta", env: { AUTH_INVITE_REQUIRED: "false" }, inviteRequired: false },
  { name: "explicit invite gate", env: { AUTH_INVITE_REQUIRED: "true" }, inviteRequired: true },
])("supports $name", ({ env, inviteRequired }) =>
  Effect.gen(function* () {
    const config = yield* AuthConfig;
    expect(config.inviteRequired).toBe(inviteRequired);
  }).pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: {
            AUTH_API_PUBLIC_ORIGIN: "http://api.test",
            AUTH_DASHBOARD_PUBLIC_ORIGIN: "http://dashboard.test",
            ...env,
          },
        }),
      ),
    ),
  ),
);
