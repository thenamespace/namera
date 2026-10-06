import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

let directory: string;
let origin: string;
const server = createServer((_request, response) => {
  response.writeHead(401, { "content-type": "application/json" });
  response.end(JSON.stringify({ _tag: "Unauthorized", message: "secret-provider-message" }));
});
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "namera-errors-"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(directory, { recursive: true, force: true });
});

const run = (args: string[], env: Record<string, string> = {}) =>
  new Promise<{ code: string | number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      ["--conditions=namera-source", "--import", "tsx", "src/index.ts", ...args],
      {
        cwd: new URL("../..", import.meta.url),
        env: {
          ...process.env,
          XDG_CONFIG_HOME: directory,
          NAMERA_API_KEY: "",
          NAMERA_API_URL: origin,
          NO_COLOR: "1",
          ...env,
        },
        timeout: 60_000,
      },
      (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr }),
    );
  });

describe("CLI failure output", { timeout: 65_000 }, () => {
  it.each(["pretty", "json", "ndjson"])(
    "reports invalid imports in %s without stacks or secret input",
    async (format) => {
      const result = await run([
        "--output",
        format,
        "session-key",
        "import",
        "secret-export-invalid!",
      ]);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("secret-export-invalid");
      expect(result.stderr).not.toMatch(/at .*\(|node_modules|SessionKeystoreError/);
      if (format === "pretty") expect(result.stderr).toContain("-> Copy the entire import command");
      else
        expect(JSON.parse(result.stderr)).toMatchObject({
          error: { code: "INVALID_EXPORT", nextStep: expect.any(String), retryable: false },
        });
    },
  );

  it("keeps errors visible with quiet", async () => {
    const result = await run(["--quiet", "session-key", "import", "invalid!"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("encrypted session-key export is invalid");
    expect(result.stderr).not.toContain("INVALID_EXPORT");
  });

  it("reports parser errors as clean JSON without echoing invalid arguments", async () => {
    const result = await run(["--output=json", "wallet", "list", "--secret-invalid-flag"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr).error.code).toBe("INVALID_ARGUMENT");
    expect(result.stderr).not.toContain("secret-invalid");
  });

  it("retains successful help", async () => {
    const result = await run(["session-key", "import", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("encrypted-export");
    expect(result.stderr).toBe("");
  });

  it("names missing required arguments without dumping help", async () => {
    const result = await run(["session-key", "import"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("encrypted-export");
    expect(result.stderr).toContain("--help");
  });

  it("translates API failures into actionable structured errors", async () => {
    const result = await run(["--output", "json", "wallet", "list"], {
      NAMERA_API_KEY: "test-only",
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: { code: "UNAUTHORIZED", nextStep: expect.stringContaining("login") },
    });
    expect(result.stderr).not.toContain("secret-provider");
  });

  it("keeps MCP startup failures off protocol stdout", async () => {
    const result = await run(["mcp", "serve", "--profile", "../invalid-profile"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("command input is invalid");
    expect(result.stderr).not.toContain("../invalid-profile");
  });

  it("handles invalid-host defects without a stack trace", async () => {
    const result = await run(["--output", "json", "wallet", "list"], {
      NAMERA_API_KEY: "test-only",
      NAMERA_API_URL: "not-a-url",
    });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error.code).toBe("INVALID_HOST");
  });
});
