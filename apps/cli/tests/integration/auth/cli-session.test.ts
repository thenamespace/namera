import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as CliSession from "../../../src/services/cli-session.js";
import type * as Config from "../../../src/services/config.js";

const keyring = vi.hoisted(() => ({ records: new Map<string, string>(), failPhase: "" }));
vi.mock("@napi-rs/keyring", () => ({
  Entry: class {
    constructor(
      _service: string,
      readonly name: string,
    ) {}
    getPassword() {
      return keyring.records.get(this.name) ?? null;
    }
    setPassword(value: string) {
      if (JSON.parse(value).phase === keyring.failPhase) throw new Error("keyring write failed");
      keyring.records.set(this.name, value);
    }
    deletePassword() {
      keyring.records.delete(this.name);
    }
  },
}));

const origin = "https://api.example.test";
const credentials = {
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt: 0,
  scopes: ["accounts:read"],
};
const response = (scope = "accounts:read") =>
  Response.json({
    access_token: "new-access",
    refresh_token: "new-refresh",
    token_type: "Bearer",
    expires_in: 3600,
    scope,
  });
let directory: string;
let session: typeof CliSession;
let config: typeof Config;
const seed = async (profile = "test") => {
  const generation = await session.beginCliLogin(profile, origin);
  await session.completeCliLogin(profile, generation, { baseUrl: origin }, credentials);
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "namera-cli-session-"));
  vi.stubEnv("XDG_CONFIG_HOME", directory);
  vi.resetModules();
  keyring.records.clear();
  keyring.failPhase = "";
  session = await import("../../../src/services/cli-session.js");
  config = await import("../../../src/services/config.js");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("ordinary CLI credential lifecycle", () => {
  it("serializes concurrent refreshes and uses the replacement token", async () => {
    await seed();
    const fetch = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetch);
    expect(
      await Promise.all([
        session.getValidAccessToken("test", origin),
        session.getValidAccessToken("test", origin),
      ]),
    ).toEqual(["new-access", "new-access"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("never replays a refresh after a lost response", async () => {
    await seed();
    const fetch = vi.fn(async () => {
      throw new Error("lost response");
    });
    vi.stubGlobal("fetch", fetch);
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(keyring.records.get("test") ?? "null")).toMatchObject({
      phase: "refreshing",
      refreshToken: null,
      accessToken: "",
    });
  });
  it("never replays after replacement credential persistence fails", async () => {
    await seed();
    keyring.failPhase = "ready";
    const fetch = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetch);
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "KEYRING_UNAVAILABLE",
    });
    keyring.failPhase = "";
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("fails closed when a new process reads persisted refresh uncertainty", async () => {
    await seed();
    const saved = JSON.parse(keyring.records.get("test") ?? "null");
    keyring.records.set(
      "test",
      JSON.stringify({ ...saved, phase: "refreshing", accessToken: "", refreshToken: null }),
    );
    vi.resetModules();
    const restarted = await import("../../../src/services/cli-session.js");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(restarted.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("logs out locally without touching another profile or signing-key entry", async () => {
    await seed();
    await seed("other");
    keyring.records.set("signing-key", "synthetic-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await session.logoutCliSession("test");
    expect(keyring.records.has("test")).toBe(false);
    expect(keyring.records.has("other")).toBe(true);
    expect(keyring.records.get("signing-key")).toBe("synthetic-key");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not send a refresh if the uncertainty marker cannot be persisted", async () => {
    await seed();
    keyring.failPhase = "refreshing";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "KEYRING_UNAVAILABLE",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not restore credentials when logout races an in-flight refresh", async () => {
    await seed();
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        started();
        return pending;
      }),
    );
    const refresh = session.getValidAccessToken("test", origin);
    await entered;
    const logout = session.logoutCliSession("test");
    finish(response());
    await Promise.all([refresh, logout]);
    expect(keyring.records.has("test")).toBe(false);
    expect((await config.readCliConfig()).profiles.test).toBeUndefined();
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("rejects completion of a login cancelled by logout", async () => {
    const generation = await session.beginCliLogin("test", origin);
    await session.logoutCliSession("test");
    await expect(
      session.completeCliLogin("test", generation, { baseUrl: origin }, credentials),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(keyring.records.has("test")).toBe(false);
  });
  it("rejects a superseded login generation", async () => {
    const old = await session.beginCliLogin("test", origin);
    const current = await session.beginCliLogin("test", origin);
    await expect(
      session.completeCliLogin("test", old, { baseUrl: origin }, credentials),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await session.completeCliLogin("test", current, { baseUrl: origin }, credentials);
  });
  it("rejects credentials for a different API origin without sending them", async () => {
    await seed();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      session.getValidAccessToken("test", "https://other.example.test"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects refresh scope escalation and prevents replay", async () => {
    await seed();
    const fetch = vi.fn(async () => response("accounts:read accounts:write"));
    vi.stubGlobal("fetch", fetch);
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("requires fresh login for legacy credentials and permits local logout", async () => {
    keyring.records.set("test", JSON.stringify(credentials));
    await expect(session.getValidAccessToken("test", origin)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await session.logoutCliSession("test");
    await seed();
    expect(JSON.parse(keyring.records.get("test") ?? "null").phase).toBe("ready");
  });
  it("preserves separate profiles during concurrent login completion", async () => {
    await Promise.all([seed("first"), seed("second")]);
    expect(Object.keys((await config.readCliConfig()).profiles).toSorted()).toEqual([
      "first",
      "second",
    ]);
  });
});
