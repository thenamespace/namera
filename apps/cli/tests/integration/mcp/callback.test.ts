import { describe, expect, it } from "vitest";

import { listenForAuthorization } from "../../../src/services/mcp/callback.js";

describe("MCP OAuth callback", () => {
  it("rejects bad state, duplicate fields, wrong origin and replay without consuming valid consent", async () => {
    const controller = new AbortController();
    const listener = await listenForAuthorization("a".repeat(43), controller.signal);
    try {
      for (const query of [
        "state=wrong&code=x",
        `state=${"é".repeat(43)}&code=x`,
        `state=${"a".repeat(43)}&code=x&code=y`,
      ]) {
        // Keep rejection attempts ordered to verify none consumes the callback.
        // oxlint-disable-next-line no-await-in-loop
        const response = await fetch(`${listener.callback}?${query}`);
        expect(response.status).toBe(400);
      }
      const valid = `${listener.callback}?state=${"a".repeat(43)}&code=accepted`;
      expect((await fetch(valid, { headers: { origin: "https://evil.test" } })).status).toBe(400);
      expect((await fetch(valid)).status).toBe(200);
      expect(await listener.code).toBe("accepted");
      expect((await fetch(valid)).status).toBe(400);
    } finally {
      listener.close();
    }
  });
  it("cancels and releases its port", async () => {
    const controller = new AbortController();
    const listener = await listenForAuthorization("state", controller.signal);
    controller.abort();
    await expect(listener.code).rejects.toThrow("cancelled");
    await expect(fetch(listener.callback)).rejects.toThrow();
    listener.close();
  });

  it("handles denial without accepting a later replay", async () => {
    const listener = await listenForAuthorization("state", new AbortController().signal);
    try {
      expect((await fetch(`${listener.callback}?state=state&error=access_denied`)).status).toBe(
        400,
      );
      await expect(listener.code).rejects.toThrow("denied");
      expect((await fetch(`${listener.callback}?state=state&code=late`)).status).toBe(400);
    } finally {
      listener.close();
    }
  });
});
