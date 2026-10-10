import { createServer } from "node:http";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runCli } from "../../fixtures/command.js";
import {
  operationWallet as wallet,
  operationKey as key,
  simulation,
} from "../../fixtures/operation.js";
import { runInteractiveCli } from "../../fixtures/terminal.js";
const requests: { path: string; body: unknown }[] = [];
let wrongWallet = false;
let emptyWallets = false;
let managed = false;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body: unknown = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
  const path = request.url ?? "";
  requests.push({ path, body });
  response.setHeader("content-type", "application/json");
  if (path === "/wallets") response.end(JSON.stringify(emptyWallets ? [] : [wallet]));
  else if (path === `/wallets/${wallet.id}`) response.end(JSON.stringify(wallet));
  else if (path === `/session-keys/wallets/${wallet.id}`)
    response.end(
      JSON.stringify([
        key,
        {
          ...key,
          id: wallet.organizationId,
          walletId: wallet.organizationId,
          metadata: { version: 1, name: "Unrelated key" },
        },
      ]),
    );
  else if (path === `/session-keys/${key.id}`)
    response.end(
      JSON.stringify({
        ...key,
        ...(managed
          ? { signer: { ...key.signer, custody: "namera-managed", provider: "1claw" } }
          : {}),
        walletId: wrongWallet ? wallet.organizationId : wallet.id,
      }),
    );
  else if (path === "/executions/simulate") response.end(JSON.stringify(simulation));
  else if (managed && path === "/signatures/prepare")
    response.end(
      JSON.stringify({
        namespace: "eip155",
        operationId: key.id,
        installationId: key.id,
        signingKeyId: key.signingKeyId,
        request: body,
        signing: { method: "server" },
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
  else if (managed && path === "/signatures/complete")
    response.end(
      JSON.stringify({
        namespace: "eip155",
        walletId: wallet.id,
        chainId: "eip155:8453",
        account: wallet.address,
        type: "message",
        signature: "0x1234",
      }),
    );
  else if (path === "/signatures/verify")
    response.end(
      JSON.stringify({
        namespace: "eip155",
        walletId: wallet.id,
        chainId: "eip155:8453",
        account: wallet.address,
        type: "message",
        valid: true,
      }),
    );
  else {
    response.statusCode = 404;
    response.end("{}");
  }
});
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  requests.length = 0;
  wrongWallet = false;
  emptyWallets = false;
  managed = false;
});
const env = () => ({
  ...process.env,
  NAMERA_API_KEY: "operation-test-only",
  NAMERA_API_URL: origin,
  NO_COLOR: "1",
  TERM: "xterm-256color",
});
const run = (args: string[]) => runCli(args, env());
const scope = [
  "--namespace",
  "evm",
  "--wallet",
  wallet.id,
  "--session-key",
  key.id,
  "--network",
  "Base",
];
const call = ["--to", wallet.address, "--value", "0", "--data", "0x"];

describe("operation flags and prompts", { timeout: 65_000 }, () => {
  it("signs with a managed session using the existing command without importing a key", async () => {
    managed = true;
    const result = await run([
      "sign",
      ...scope,
      "--type",
      "message",
      "--message",
      "Hello",
      "--output",
      "json",
    ]);
    expect(JSON.parse(result.stdout)).toMatchObject({ signature: "0x1234", walletId: wallet.id });
    expect(requests.filter(({ body }) => body !== undefined)).toEqual([
      {
        path: "/signatures/prepare",
        body: {
          namespace: "eip155",
          walletId: wallet.id,
          sessionKeyId: key.id,
          chainId: "eip155:8453",
          type: "message",
          message: "Hello",
        },
      },
      { path: "/signatures/complete", body: { namespace: "eip155", operationId: key.id } },
    ]);
  });
  it.each([["execution", "execute"], ["execution", "simulate"], ["sign"], ["verify-signature"]])(
    "reports missing namespace without opening a headless prompt: %j",
    async (...command) => {
      await expect(run(command)).rejects.toMatchObject({
        stderr: expect.stringContaining("Missing --namespace."),
      });
      expect(requests).toEqual([]);
    },
  );
  it("skips a supplied namespace and requests the wallet next", async () => {
    await expect(run(["execution", "execute", "--namespace", "evm"])).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing --wallet."),
    });
  });
  it("simulates with individual flags, named output, and original JSON", async () => {
    const result = await run(["execution", "simulate", ...scope, ...call]);
    expect(result.stdout).toContain("-> Account: 💳 Trading Account");
    expect(result.stdout).toContain("-> Session key: Trading key");
    expect(result.stdout).toContain("-> Network: Base");
    expect(result.stdout).not.toContain(wallet.id);
    expect(requests.at(-1)).toEqual({
      path: "/executions/simulate",
      body: {
        namespace: "eip155",
        walletId: wallet.id,
        sessionKeyId: key.id,
        chainId: "eip155:8453",
        calls: [{ to: wallet.address, value: "0", data: "0x" }],
      },
    });
    const json = await run(["execution", "simulate", ...scope, ...call, "--output", "json"]);
    expect(JSON.parse(json.stdout)).toEqual(simulation);
  });
  it.each([["execution", "execute"], ["execution", "simulate"], ["sign"]])(
    "rejects a key from another wallet before any operation: %j",
    async (...command) => {
      wrongWallet = true;
      await expect(run([...command, ...scope])).rejects.toMatchObject({
        stderr: expect.stringContaining("This session key does not belong to the selected wallet"),
      });
      expect(requests.every((request) => request.body === undefined)).toBe(true);
    },
  );
  it("rejects unsupported namespaces with a next step", async () => {
    await expect(run(["sign", "--namespace", "solana"])).rejects.toMatchObject({
      stderr: expect.stringContaining("The value for --namespace is invalid."),
    });
    expect(requests).toEqual([]);
  });
  it("verifies without requesting a session key", async () => {
    const result = await run([
      "verify-signature",
      "--namespace",
      "evm",
      "--wallet",
      wallet.id,
      "--network",
      "8453",
      "--type",
      "message",
      "--message",
      "hello",
      "--signature",
      "0x1234",
    ]);
    expect(result.stdout).toContain("Signature valid");
    expect(requests.map((request) => request.path)).toEqual([
      `/wallets/${wallet.id}`,
      "/signatures/verify",
    ]);
  });
  it("requires an explicit gas budget before self-funded execution", async () => {
    await expect(
      run(["execution", "execute", ...scope, ...call, "--sponsor", "false"]),
    ).rejects.toMatchObject({ stderr: expect.stringContaining("Missing --max-gas-cost-wei.") });
    expect(requests.every((request) => request.body === undefined)).toBe(true);
  });
  it.each([
    ["--type", "message", "--typed-data", "{}"],
    ["--type", "typed-data", "--message", "hello"],
    ["--type", "typed-data", "--typed-data", "not-json"],
  ])("rejects conflicting or invalid signature inputs before signing: %j", async (...flags) => {
    await expect(run(["sign", ...scope, ...flags])).rejects.toMatchObject({
      stderr: expect.stringMatching(/cannot be used|--typed-data is invalid/),
    });
    expect(requests.every((request) => request.body === undefined)).toBe(true);
  });
  it("rejects negative transaction values before simulation", async () => {
    await expect(
      run([
        "execution",
        "simulate",
        ...scope,
        "--to",
        wallet.address,
        "--value=-1",
        "--data",
        "0x",
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("non-negative whole number of wei"),
    });
    expect(requests.every((request) => request.body === undefined)).toBe(true);
  });
  it("keeps machine-readable missing-input errors on stderr", async () => {
    await expect(
      run(["verify-signature", "--namespace", "evm", "--output", "json"]),
    ).rejects.toMatchObject({
      stdout: "",
      stderr: expect.stringContaining('"message":"Missing --wallet."'),
    });
  });
  it("rejects conflicting JSON and individual inputs", async () => {
    await expect(run(["sign", "--params", "{}", "--message", "hello"])).rejects.toMatchObject({
      stderr: expect.stringContaining("Do not combine --params"),
    });
    expect(requests).toEqual([]);
  });
  it("preserves --params without adding read-scope requirements", async () => {
    await run([
      "execution",
      "simulate",
      "--params",
      JSON.stringify({
        namespace: "eip155",
        walletId: wallet.id,
        sessionKeyId: key.id,
        chainId: "eip155:8453",
        calls: [{ to: wallet.address, value: "0", data: "0x" }],
      }),
    ]);
    expect(requests.map((request) => request.path)).toEqual(["/executions/simulate"]);
  });
  it.skipIf(process.platform !== "darwin")(
    "selects namespace, wallet, and only its keys using the keyboard",
    async () => {
      const result = await interactive(
        ["execution", "simulate", "--network", "Base", ...call],
        ["Choose a network type", "Choose a wallet", "Choose a session key"],
      );
      expect(result.code, result.output).toBe(0);
      expect(result.output).toContain("Trading key");
      expect(result.output).not.toContain("Unrelated key");
      expect(result.output).toContain("Transaction preview");
    },
  );
  it.skipIf(process.platform !== "darwin")(
    "explains an empty wallet list without opening an empty selector",
    async () => {
      emptyWallets = true;
      const result = await interactive(["sign", "--namespace", "evm"], []);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("No accessible EVM wallets found.");
      expect(result.output).not.toContain("Choose a wallet");
    },
  );
});

const interactive = (args: string[], prompts: string[]) =>
  runInteractiveCli(
    args,
    env(),
    prompts.map((prompt) => ({ matches: [prompt], input: "\r" })),
  );
