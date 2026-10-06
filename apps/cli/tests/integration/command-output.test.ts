import { execFile, spawn } from "node:child_process";
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
const secondWallet = {
  ...wallet,
  id: "01950000-0000-7000-8000-000000000004",
  metadata: { version: 1, name: "Savings" },
  address: `0x${"22".repeat(20)}`,
};
let listedWallets = [wallet];
const sessionKey = {
  id: "01950000-0000-7000-8000-000000000005",
  organizationId: wallet.organizationId,
  walletId: wallet.id,
  signingKeyId: wallet.owner.signingKeyId,
  namespace: "eip155",
  metadata: { version: 1, name: "Trading key", description: "Selected trading key" },
  status: "pending",
  policies: [],
  policyHash: "test-policy-hash",
  revokedAt: null,
  createdAt: wallet.createdAt,
  wallet,
  creator: {
    organizationMember: {
      id: wallet.id,
      userId: wallet.id,
      organizationId: wallet.organizationId,
      organizationRoleId: wallet.id,
      joinedAt: wallet.createdAt,
    },
    user: {
      id: wallet.id,
      email: "cli-output@example.com",
      emailVerified: true,
      metadata: { version: 1, name: "CLI tester" },
      lastLoginAt: null,
    },
    organizationRole: {
      id: wallet.id,
      key: "tester",
      metadata: { version: 1, name: "Tester" },
      type: "custom",
      permissions: [],
      systemRoleId: null,
    },
  },
  installations: [],
};
const secondSessionKey = {
  ...sessionKey,
  id: "01950000-0000-7000-8000-000000000006",
  metadata: { version: 1, name: "Savings key", description: "Selected savings key" },
};
let listedSessionKeys = [sessionKey, secondSessionKey];
const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.url === "/wallets") response.end(JSON.stringify(listedWallets));
  else if (request.url === `/wallets/${wallet.id}`) response.end(JSON.stringify(wallet));
  else if (request.url === `/wallets/${secondWallet.id}`)
    response.end(JSON.stringify(secondWallet));
  else if (request.url === "/session-keys") response.end(JSON.stringify(listedSessionKeys));
  else if (request.url === `/session-keys/${sessionKey.id}`)
    response.end(JSON.stringify(sessionKey));
  else if (request.url === `/session-keys/${secondSessionKey.id}`)
    response.end(JSON.stringify(secondSessionKey));
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

// Exercise the actual terminal prompt without touching saved profiles or keyrings.
const pickResource = (keys: string, command = "wallet") =>
  new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        "import os, pty, sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(sys.argv[1:])))",
        process.execPath,
        "--conditions=namera-source",
        "--import",
        "tsx",
        "src/index.ts",
        command,
        "get",
      ],
      {
        cwd: new URL("../..", import.meta.url),
        env: {
          ...process.env,
          NAMERA_API_KEY: "output-test-only",
          NAMERA_API_URL: origin,
          TERM: "xterm-256color",
          NO_COLOR: "1",
        },
        detached: true,
        stdio: "pipe",
      },
    );
    let output = "";
    let selected = false;
    const timer = setTimeout(() => {
      if (child.pid) process.kill(-child.pid, "SIGKILL");
      reject(new Error(`${command} picker timed out: ${output}`));
    }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (!selected && output.includes("Choose a") && output.includes("Savings")) {
        selected = true;
        child.stdin.write(keys);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });

// Allow cold CLI startup on shared CI runners. Keep this above the subprocess
// deadline so a hung command reports its captured output before Vitest times out.
describe("CLI command output", { timeout: 65_000 }, () => {
  it.skipIf(process.platform !== "darwin")(
    "selects the second wallet using the keyboard",
    async () => {
      listedWallets = [
        wallet,
        { ...secondWallet, metadata: { ...secondWallet.metadata, logo: wallet.metadata.logo } },
      ];
      try {
        const result = await pickResource("\u001b[B\r");
        expect(result.code).toBe(0);
        expect(result.output).toContain(`Address: ${secondWallet.address}`);
        expect(result.output).not.toContain(`Address: ${wallet.address}`);
      } finally {
        listedWallets = [wallet];
      }
    },
  );
  it.skipIf(process.platform !== "darwin")("cancels without fetching wallet details", async () => {
    listedWallets = [
      wallet,
      { ...secondWallet, metadata: { ...secondWallet.metadata, logo: wallet.metadata.logo } },
    ];
    try {
      const result = await pickResource("\u0003");
      expect(result.code).not.toBe(0);
      expect(result.output).not.toContain("Address:");
      expect(result.output).not.toContain("Namera could not complete this command");
    } finally {
      listedWallets = [wallet];
    }
  });
  it.skipIf(process.platform !== "darwin")("does not open an empty picker", async () => {
    listedWallets = [];
    try {
      const result = await pickResource("");
      expect(result.code).toBe(0);
      expect(result.output).toContain("No delegated wallets found.");
      expect(result.output).not.toContain("Choose a wallet");
    } finally {
      listedWallets = [wallet];
    }
  });
  it.skipIf(process.platform !== "darwin")("selects a session key using the keyboard", async () => {
    const result = await pickResource("\u001b[B\r", "session-key");
    expect(result.code).toBe(0);
    expect(result.output).toContain("Description: Selected savings key");
    expect(result.output).not.toContain("Description: Selected trading key");
  });
  it.skipIf(process.platform !== "darwin")("cancels the session key picker cleanly", async () => {
    const result = await pickResource("\u0003", "session-key");
    expect(result.code).not.toBe(0);
    expect(result.output).not.toContain("Description:");
    expect(result.output).not.toContain("Namera could not complete this command");
    expect(result.output).toContain("Trading key");
    expect(result.output).toContain("Output test wallet");
    expect(result.output).not.toContain("Pending");
    expect(result.output).not.toContain("Expiry");
    expect(result.output).not.toContain(sessionKey.id);
    expect(result.output).not.toContain(secondSessionKey.id);
  });
  it.skipIf(process.platform !== "darwin")("handles an empty session key list", async () => {
    listedSessionKeys = [];
    try {
      const result = await pickResource("", "session-key");
      expect(result.code).toBe(0);
      expect(result.output).toContain("No session keys found.");
      expect(result.output).not.toContain("Choose a session key");
    } finally {
      listedSessionKeys = [sessionKey, secondSessionKey];
    }
  });
  it("preserves session key JSON with an explicit ID", async () => {
    const result = await run(["session-key", "get", sessionKey.id, "--output", "json"]);
    expect(JSON.parse(result.stdout)).toMatchObject(sessionKey);
  });
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
