import { spawn } from "node:child_process";
import { once } from "node:events";

import { describe, expect, it, vi } from "vitest";

describe("MCP command lifecycle", () => {
  it.each(["2026-07-28", "2025-11-25", "2025-06-18"])(
    "starts %s without login and exits when its client closes stdin",
    async (protocolVersion) => {
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
        const metadata =
          protocolVersion === "2026-07-28"
            ? {
                _meta: {
                  "io.modelcontextprotocol/protocolVersion": protocolVersion,
                  "io.modelcontextprotocol/clientCapabilities": {},
                },
              }
            : {};
        child.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: protocolVersion === "2026-07-28" ? "server/discover" : "initialize",
            params:
              protocolVersion === "2026-07-28"
                ? metadata
                : { protocolVersion, capabilities: {}, clientInfo: { name: "test", version: "1" } },
          })}\n`,
        );
        // Source loading competes with other packages on shared CI runners.
        await vi.waitFor(() => expect(stdout, stderr).toContain('"id":1'), { timeout: 60_000 });
        if (protocolVersion !== "2026-07-28") {
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
          );
        }
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: metadata })}\n`,
        );
        await vi.waitFor(() => expect(stdout).toContain('"id":2'));
        const messages = stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const discovery = messages.find((message) => message.id === 1)?.result;
        expect(discovery).toMatchObject(
          protocolVersion === "2026-07-28"
            ? {
                supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18"],
                resultType: "complete",
              }
            : { protocolVersion },
        );
        expect(messages.find((message) => message.id === 2)?.result.tools).toHaveLength(10);
        expect(stderr).not.toContain("Authorize Namera");
        const exited = once(child, "exit");
        child.stdin.end();
        await vi.waitFor(() => expect(child.exitCode).not.toBeNull(), { timeout: 5000 });
        expect((await exited)[0]).toBe(0);
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    },
    70_000,
  );
});
