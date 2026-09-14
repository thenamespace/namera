import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Redacted } from "effect";

import { describe, expect, it, vi } from "vitest";

import {
  type McpCredential,
  type McpCredentialStore,
  withCredentialLock,
} from "../../../src/services/mcp/credential-store.js";
import { createMcpSession, type McpOAuthProvider } from "../../../src/services/mcp/session.js";

const token = () => ({
  accessToken: Redacted.make("new-access"),
  refreshToken: Redacted.make("new-refresh"),
  expiresAt: 100_000,
  scopes: ["mcp:read", "offline_access"],
});
const saved = (): McpCredential => ({
  version: 1,
  generation: "one",
  phase: "ready",
  clientId: "client",
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt: 0,
  scopes: ["mcp:read", "offline_access"],
});

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "namera-mcp-auth-"));
  let value: McpCredential | undefined;
  const store: McpCredentialStore = {
    read: () => value,
    write: (next) => {
      value = structuredClone(next);
    },
    lock: (run) => withCredentialLock(join(directory, "lock.sqlite"), run),
  };
  const provider: McpOAuthProvider = {
    register: vi.fn(async () => "client"),
    exchange: vi.fn(async () => token()),
    refresh: vi.fn(async () => token()),
    revoke: vi.fn(async () => undefined),
  };
  const config = {
    apiOrigin: "https://api.namera.test",
    profile: "codex",
    store,
    provider: () => provider,
    now: () => 100,
    notify: () => undefined,
  };
  return {
    store,
    provider,
    config,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
};

describe("persistent MCP authorization", () => {
  it("restores credentials across instances and serializes rotating refreshes", async () => {
    const f = await fixture();
    try {
      f.store.write(saved());
      const first = createMcpSession(f.config);
      const second = createMcpSession(f.config);
      const result = await Promise.all([first.credentials(), second.credentials()]);
      expect(f.provider.refresh).toHaveBeenCalledTimes(1);
      expect(result.map((entry) => entry?.accessToken)).toEqual(["new-access", "new-access"]);
      expect(second.status().status).toBe("connected");
      expect(JSON.stringify(second.status())).not.toContain("new-access");
      await second.logout();
      expect(await first.credentials()).toBeUndefined();
      expect(f.provider.revoke).toHaveBeenCalledTimes(1);
    } finally {
      await f.cleanup();
    }
  });

  it("never replays an ambiguously consumed refresh token", async () => {
    const f = await fixture();
    try {
      f.store.write(saved());
      vi.mocked(f.provider.refresh).mockRejectedValue(new Error("offline"));
      await expect(createMcpSession(f.config).credentials()).rejects.toThrow();
      expect(f.store.read()?.phase).toBe("refreshing");
      expect(await createMcpSession(f.config).credentials()).toBeUndefined();
      expect(f.provider.refresh).toHaveBeenCalledTimes(1);
    } finally {
      await f.cleanup();
    }
  });

  it("uses real loopback consent with state and PKCE, persists tokens and closes the callback", async () => {
    const f = await fixture();
    let callback = "";
    try {
      const connection = createMcpSession({
        ...f.config,
        openBrowser: async (value) => {
          const authorize = new URL(value);
          callback = authorize.searchParams.get("redirect_uri") ?? "";
          expect(authorize.origin).toBe(f.config.apiOrigin);
          expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
          expect(authorize.searchParams.get("code_challenge")).toHaveLength(43);
          const response = await fetch(
            `${callback}?state=${authorize.searchParams.get("state")}&code=valid-code`,
          );
          expect(response.status).toBe(200);
        },
      });
      await connection.login();
      expect(f.provider.exchange).toHaveBeenCalledWith(
        "client",
        "valid-code",
        expect.stringMatching(/^[\w-]{43}$/),
      );
      expect((await createMcpSession(f.config).credentials())?.accessToken).toBe("new-access");
      await expect(fetch(callback)).rejects.toThrow();
      connection.close();
    } finally {
      await f.cleanup();
    }
  });

  it("does not resurrect a login after logout", async () => {
    const f = await fixture();
    try {
      const connection = createMcpSession({
        ...f.config,
        openBrowser: async (value) => {
          const url = new URL(value);
          await connection.logout();
          await fetch(
            `${url.searchParams.get("redirect_uri")}?state=${url.searchParams.get("state")}&code=code`,
          );
        },
      });
      await expect(connection.login()).rejects.toThrow("cancelled or replaced");
      expect(await connection.credentials()).toBeUndefined();
      expect(f.provider.revoke).toHaveBeenCalledTimes(1);
      connection.close();
    } finally {
      await f.cleanup();
    }
  });

  it("revokes issued tokens when the keyring cannot save them", async () => {
    const f = await fixture();
    const connection = createMcpSession({
      ...f.config,
      store: {
        ...f.store,
        write: (value) => {
          if (value.phase === "ready") throw new Error("Keyring unavailable");
          f.store.write(value);
        },
      },
      openBrowser: async (value) => {
        const url = new URL(value);
        await fetch(
          `${url.searchParams.get("redirect_uri")}?state=${url.searchParams.get("state")}&code=code`,
        );
      },
    });
    try {
      await expect(connection.login()).rejects.toThrow("Keyring unavailable");
      expect(f.provider.revoke).toHaveBeenCalledTimes(1);
      expect(await connection.credentials()).toBeUndefined();
    } finally {
      connection.close();
      await f.cleanup();
    }
  });

  it("rejects expanded refresh scopes without replaying the consumed token", async () => {
    const f = await fixture();
    try {
      f.store.write(saved());
      vi.mocked(f.provider.refresh).mockResolvedValue({
        ...token(),
        scopes: ["mcp:read", "mcp:execute", "offline_access"],
      });
      const connection = createMcpSession(f.config);
      await expect(connection.credentials()).rejects.toThrow("expanded unexpectedly");
      expect(await connection.credentials()).toBeUndefined();
      expect(f.provider.refresh).toHaveBeenCalledTimes(1);
    } finally {
      await f.cleanup();
    }
  });
});
