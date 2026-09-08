import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  acceptsLocalMcpRequest,
  LocalMcpCodeChallenge,
  LocalMcpCodeVerifier,
  LocalMcpRedirectUri,
  localMcpUrls,
  matchesRegisteredRedirect,
} from "../../../src/services/mcp/transport-security.js";

describe("local MCP transport security", () => {
  const urls = localMcpUrls(3847);

  it("pins discovery, resource and callback to the loopback listener", () => {
    expect(urls.resource).toBe("http://127.0.0.1:3847/mcp");
    expect(new URL(urls.callback).origin).toBe(urls.origin);
    expect(new URL(urls.resourceMetadata).origin).toBe(urls.origin);
    for (const port of [0, 80, 65536, 3847.5, Number.NaN]) {
      expect(() => localMcpUrls(port)).toThrow();
    }
  });

  it("accepts native requests but rejects foreign origins and rebinding hosts", () => {
    expect(acceptsLocalMcpRequest(urls, { host: urls.authority })).toBe(true);
    expect(acceptsLocalMcpRequest(urls, { host: urls.authority, origin: urls.origin })).toBe(true);
    for (const host of [undefined, "localhost:3847", "evil.test:3847", "127.0.0.1:8080"]) {
      expect(acceptsLocalMcpRequest(urls, { host })).toBe(false);
    }
    for (const origin of [
      "null",
      "https://evil.test",
      "http://127.0.0.1:3000",
      `${urls.origin}/`,
    ]) {
      expect(acceptsLocalMcpRequest(urls, { host: urls.authority, origin })).toBe(false);
    }
  });

  it("accepts secure and loopback callbacks only, with exact redirect matching", () => {
    const decode = Schema.decodeUnknownSync(LocalMcpRedirectUri);
    for (const uri of [
      "https://agent.example/oauth/callback",
      "http://127.0.0.1:9090/callback?host=agent",
      "http://[::1]:9090/callback",
    ])
      expect(decode(uri)).toBe(uri);

    for (const uri of [
      "http://agent.example/callback",
      "http://localhost:9090/callback",
      "https://user:password@agent.example/callback",
      "https://agent.example/callback#",
      "https://agent.example/callback#token",
      "javascript:alert(1)",
      "/callback",
    ])
      expect(() => decode(uri)).toThrow();

    const registered = ["https://agent.example/callback"] as const;
    expect(matchesRegisteredRedirect(registered, registered[0])).toBe(true);
    for (const uri of [
      "https://agent.example/callback/",
      "https://agent.example:443/callback",
      "https://agent.example/callback?redirect=evil",
    ])
      expect(matchesRegisteredRedirect(registered, uri)).toBe(false);
  });

  it("rejects malformed PKCE inputs before code lookup", () => {
    const challenge = Schema.decodeUnknownSync(LocalMcpCodeChallenge);
    const verifier = Schema.decodeUnknownSync(LocalMcpCodeVerifier);
    expect(challenge("a".repeat(43))).toHaveLength(43);
    expect(verifier("a".repeat(128))).toHaveLength(128);
    expect(() => challenge("a".repeat(44))).toThrow();
    expect(() => challenge(`${"a".repeat(42)}=`)).toThrow();
    expect(() => verifier("short")).toThrow();
    expect(() => verifier("a".repeat(129))).toThrow();
    expect(() => verifier(`${"a".repeat(42)} `)).toThrow();
  });
});
