import { spawn } from "node:child_process";
import { once } from "node:events";

import { describe, expect, it, vi } from "vitest";

describe("MCP command lifecycle", () => {
  it("starts stdio without login and exits when its client closes stdin", async () => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=namera-source",
        "src/index.ts",
        "mcp",
        "serve",
        "--profile",
        "test-stdio-handshake",
      ],
      { stdio: "pipe" },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    try {
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } })}\n`,
      );
      await vi.waitFor(() => expect(stdout).toContain('"id":1'), { timeout: 10_000 });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
      );
      await vi.waitFor(() => expect(stdout).toContain('"id":2'));
      const messages = stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(messages.find((message) => message.id === 2)?.result.tools).toHaveLength(10);
      expect(stderr).not.toContain("Authorize Namera");
      const exited = once(child, "exit");
      child.stdin.end();
      await vi.waitFor(() => expect(child.exitCode).not.toBeNull(), { timeout: 5000 });
      expect((await exited)[0]).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }, 15_000);
});
