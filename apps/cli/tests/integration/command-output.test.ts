import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const wallet = {
  id: "01950000-0000-7000-8000-000000000001",
  organizationId: "01950000-0000-7000-8000-000000000002",
  namespace: "eip155",
  status: "active",
  implementation: "alchemy-modular-v2",
  metadata: { version: 1, name: "Output test wallet", logo: { type: "emoji", value: "💳" } },
  address: `0x${"11".repeat(20)}`,
  owner: {
    signingKeyId: "01950000-0000-7000-8000-000000000003",
    custody: "local",
    algorithm: "p256",
  },
  data: {
    version: 1,
    modularAccountVersion: "2.0.0",
    validatorType: "webauthn_p256",
    entryPointVersion: "0.7",
    salt: "0",
    entityId: 1,
  },
  createdAt: "2026-09-15T12:00:00.000Z",
  updatedAt: "2026-09-15T12:00:00.000Z",
};
const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/wallets") response.end(JSON.stringify([wallet]));
  else if (request.url === `/wallets/${wallet.id}`) response.end(JSON.stringify(wallet));
  else {
    response.statusCode = 404;
    response.end("{}");
  }
});
let origin: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    }),
  );
});

const run = (args: string[]) =>
  execute(
    process.execPath,
    ["--conditions=namera-source", "--import", "tsx", "src/index.ts", ...args],
    {
      cwd: new URL("../..", import.meta.url),
      env: {
        ...process.env,
        NAMERA_API_KEY: "output-test-only",
        NAMERA_API_URL: origin,
        NO_COLOR: "1",
      },
      timeout: 60_000,
    },
  ).catch((error: unknown) => {
    if (!(error instanceof Error)) throw error;
    const failure = error as Error & {
      code?: string | number;
      signal?: string;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };
    throw new Error(
      `${failure.message}\ncode=${failure.code} signal=${failure.signal} killed=${failure.killed}\nstdout: ${failure.stdout ?? ""}\nstderr: ${failure.stderr ?? ""}`,
      { cause: error },
    );
  });

// Allow cold CLI startup on shared CI runners. Keep this above the subprocess
// deadline so a hung command reports its captured output before Vitest times out.
describe("CLI command output", { timeout: 65_000 }, () => {
  it("renders wallet lists without JSON nesting or ANSI in pipes", async () => {
    const listed = await run(["wallet", "list"]);
    expect(listed.stdout).toContain("Found 1 delegated wallet:");
    expect(listed.stdout).toContain("💳 Output test wallet");
    expect(listed.stdout).not.toContain("\u001b");
  });
  it("renders wallet details", async () => {
    const detail = await run(["wallet", "get", wallet.id]);
    expect(detail.stdout).not.toContain(wallet.id);
    expect(detail.stdout).toContain(`Address: ${wallet.address}`);
  });
  it("preserves raw JSON", async () => {
    const json = await run(["--output", "json", "wallet", "list"]);
    expect(JSON.parse(json.stdout)).toMatchObject([wallet]);
  });
  it("rejects the removed NDJSON format", async () => {
    await expect(run(["--output", "ndjson", "wallet", "list"])).rejects.toThrow();
  });
  it("suppresses pretty output with quiet", async () => {
    const quiet = await run(["--quiet", "wallet", "list"]);
    expect(quiet.stdout).toBe("");
  });
});
