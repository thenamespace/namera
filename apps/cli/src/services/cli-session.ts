import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { cliConfigPath, removeProfile, saveProfile, type CliProfile } from "./config.js";
import { withCredentialLock } from "./credential-lock.js";
import {
  deleteCredentials,
  readCredentials,
  writeCredentials,
  type CredentialBundle,
} from "./credentials.js";
import { cliFailure } from "./error-feedback.js";
import { refreshCredentials } from "./oauth.js";

const withProfileLock = <A>(profile: string, run: () => Promise<A>) =>
  withCredentialLock(
    join(
      dirname(cliConfigPath),
      "auth",
      `${createHash("sha256").update(profile).digest("hex")}.lock.sqlite`,
    ),
    run,
  );

export const beginCliLogin = (profile: string, apiOrigin: string) =>
  withProfileLock(profile, async () => {
    const generation = randomUUID();
    writeCredentials(profile, {
      version: 1,
      apiOrigin,
      generation,
      phase: "authorizing",
      accessToken: "",
      refreshToken: null,
      expiresAt: 0,
      scopes: [],
    });
    return generation;
  });

export const completeCliLogin = (
  profile: string,
  generation: string,
  metadata: CliProfile,
  credentials: CredentialBundle,
) =>
  withProfileLock(profile, async () => {
    const saved = readCredentials(profile);
    if (
      saved?.generation !== generation ||
      saved.phase !== "authorizing" ||
      saved.apiOrigin !== metadata.baseUrl
    )
      throw cliFailure("UNAUTHORIZED");
    // A crash or write failure leaves authorizing state, never a usable partial login.
    await saveProfile(profile, metadata);
    writeCredentials(profile, { ...saved, ...credentials, phase: "ready" });
  });

export const logoutCliSession = (profile: string) =>
  withProfileLock(profile, async () => {
    deleteCredentials(profile);
    await removeProfile(profile);
  });

export const getValidAccessToken = (profile: string, apiOrigin: string) =>
  withProfileLock(profile, async () => {
    const saved = readCredentials(profile);
    if (saved?.phase !== "ready" || saved.apiOrigin !== apiOrigin) throw cliFailure("UNAUTHORIZED");
    if (saved.expiresAt > Date.now() + 30_000) return saved.accessToken;
    if (saved.refreshToken === null) throw cliFailure("UNAUTHORIZED");
    // Do not replay a possibly consumed token after a crash, lost response or failed write.
    writeCredentials(profile, {
      ...saved,
      phase: "refreshing",
      accessToken: "",
      refreshToken: null,
    });
    const refreshed = await refreshCredentials(apiOrigin, saved.refreshToken);
    if (refreshed.scopes.some((scope) => !saved.scopes.includes(scope)))
      throw cliFailure("UNAUTHORIZED");
    writeCredentials(profile, { ...saved, ...refreshed, phase: "ready" });
    return refreshed.accessToken;
  });
