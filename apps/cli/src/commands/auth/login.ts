import { spawn } from "node:child_process";
import { platform } from "node:os";

import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { NAMERA_API_ORIGIN, NameraClient } from "@namera-ai/sdk";

import { profileFlag } from "#/commands/common";
import { saveProfile } from "#/services/config";
import { writeCredentials } from "#/services/credentials";
import { OAuthRequestError, pollDeviceToken, startDeviceAuthorization } from "#/services/oauth";
import { printLine, runPromise } from "#/services/output";
import { version } from "#/version";

const openBrowser = (url: string) => {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
};

const waitForToken = async (
  baseUrl: string,
  deviceCode: string,
  expiresIn: number,
  initialInterval: number,
) => {
  const deadline = Date.now() + expiresIn * 1_000;
  let interval = initialInterval;
  while (Date.now() < deadline) {
    // RFC 8628 polling is deliberately sequential and observes the server-provided interval.
    // oxlint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, interval * 1_000));
    try {
      // oxlint-disable-next-line no-await-in-loop
      return await pollDeviceToken(baseUrl, deviceCode);
    } catch (error) {
      if (!(error instanceof OAuthRequestError)) throw error;
      if (error.code === "authorization_pending") continue;
      if (error.code === "slow_down") {
        interval += 5;
        continue;
      }
      throw error;
    }
  }
  throw new Error("The device authorization expired. Run namera login again.");
};

export const loginCommand = Command.make(
  "login",
  {
    profile: profileFlag,
    host: Flag.String("host").pipe(
      Flag.withDescription("Namera API origin"),
      Flag.withDefault(NAMERA_API_ORIGIN),
    ),
    deviceName: Flag.String("device-name").pipe(
      Flag.withDescription("Friendly name shown on the consent screen"),
      Flag.withDefault(`Namera CLI on ${platform()}`),
    ),
  },
  Effect.fn(function* ({ profile, host, deviceName }) {
    const baseUrl = new URL(host).origin;
    const request = yield* Effect.tryPromise(() =>
      startDeviceAuthorization(baseUrl, {
        deviceName,
        cliVersion: version,
        platform: platform(),
      }),
    );

    yield* printLine(`Open ${request.verification_uri}`);
    yield* printLine(`Confirm code: ${request.user_code}`);
    yield* Effect.sync(() => openBrowser(request.verification_uri_complete));

    const credentials = yield* Effect.tryPromise(() =>
      waitForToken(baseUrl, request.device_code, request.expires_in, request.interval),
    );
    writeCredentials(profile, credentials);

    const actor = yield* runPromise(
      new NameraClient({ accessToken: credentials.accessToken, baseUrl }).auth.currentActor(),
    );
    if (actor.type !== "cli") return yield* Effect.fail(new Error("Expected a CLI actor token."));

    yield* Effect.tryPromise(() =>
      saveProfile(profile, {
        baseUrl,
        authorizationId: actor.data.authorization.id,
        organizationId: actor.data.organizationId,
      }),
    );
    yield* printLine(`Logged in as profile "${profile}".`);
  }),
).pipe(Command.withDescription("Authorize this CLI using the browser device flow"));
