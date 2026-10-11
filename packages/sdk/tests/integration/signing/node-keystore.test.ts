import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DateTime, Redacted, Schema } from "effect";

import {
  DefaultModuleAddress,
  pack1271Signature,
  toReplaySafeTypedData,
} from "@alchemy/smart-accounts";
import { PrepareExecutionResponse, PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import type { LocalSessionKeyMaterial } from "@namera-ai/protocol/local";
import { NameraClient, sealLocalSessionKey, type NameraFetch } from "@namera-ai/sdk";
import { concatHex, hashMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NameraClient as BrowserClient } from "../../../src/index.js";
import { getSessionKeystore } from "../../../src/node/default-store.js";
import { localExecutionFixture } from "../../fixtures/local-execution.js";

const keyring = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  reads: vi.fn(),
  locked: false,
}));
vi.mock("@napi-rs/keyring", () => ({
  Entry: class {
    constructor(
      private readonly service: string,
      private readonly id: string,
    ) {}
    getPassword() {
      keyring.reads();
      if (keyring.locked) throw new Error("private native diagnostic");
      return keyring.secrets.get(`${this.service}:${this.id}`) ?? null;
    }
    setPassword(secret: string) {
      keyring.secrets.set(`${this.service}:${this.id}`, secret);
    }
    deletePassword() {
      keyring.secrets.delete(`${this.service}:${this.id}`);
    }
  },
}));

const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "namera-sdk-node-"));
  vi.stubEnv("XDG_CONFIG_HOME", directory);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-08T12:01:00Z"));
  keyring.secrets.clear();
  keyring.reads.mockClear();
  keyring.locked = false;
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

const setup = async (importKey = true) => {
  const f = localExecutionFixture();
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const binding = {
    ...f.binding,
    signerAddress: EthereumAddress.make(account.address),
    allowSignatures: true,
  };
  const material: LocalSessionKeyMaterial = {
    version: 1,
    namespace: "eip155",
    apiOrigin: "https://api.namera.ai",
    privateKey: Redacted.make(privateKey, { label: "local session key" }),
    bindings: [binding],
  };
  if (importKey) {
    const password = Redacted.make("test-only encrypted export passphrase");
    const store = await getSessionKeystore();
    await store.importKey(
      await sealLocalSessionKey(material, password),
      password,
      material.apiOrigin,
    );
  }
  const completed = {
    namespace: "eip155",
    submissionId: f.response.submissionId,
    status: "prepared",
    userOperationHash: f.response.signing.message,
  };
  const fetch = vi
    .fn<NameraFetch>()
    .mockImplementationOnce(async () =>
      json(Schema.encodeSync(PrepareExecutionResponse)(f.response)),
    )
    .mockImplementation(async () => json(completed));
  return { ...f, binding, account, fetch, completed };
};

describe("automatic Node session signing", () => {
  it("opens the CLI-compatible store and executes without a resolver", async () => {
    const f = await setup();
    const client = new NameraClient({ apiKey: "test-only", fetch: f.fetch });
    expect(await client.executions.execute(f.request)).toMatchObject({
      success: true,
      data: f.completed,
    });
    expect(keyring.reads).toHaveBeenCalledOnce();
    const completion = JSON.parse(
      new TextDecoder().decode(f.fetch.mock.calls[1]?.[1]?.body as Uint8Array),
    );
    expect(completion.signature).toMatch(/^0x[0-9a-f]+$/);
  });

  it("signs messages with the automatically unlocked key", async () => {
    const f = await setup();
    const request = {
      namespace: "eip155" as const,
      walletId: f.request.walletId,
      sessionKeyId: f.request.sessionKeyId,
      chainId: f.request.chainId,
      type: "message" as const,
      message: "Hello Namera",
    };
    const typedData = toReplaySafeTypedData({
      address: DefaultModuleAddress.SINGLE_SIGNER_VALIDATION,
      chainId: 11155111,
      hash: hashMessage(request.message),
      salt: concatHex([`0x${"00".repeat(12)}`, f.binding.walletAddress]),
    });
    const prepared = Schema.decodeUnknownSync(PrepareSignatureResponse)({
      namespace: "eip155",
      operationId: "01950000-0000-7000-8000-000000000009",
      installationId: f.binding.installationId,
      signingKeyId: f.binding.signingKeyId,
      request,
      signing: { method: "eth_signTypedData_v4", typedData },
      expiresAt: DateTime.toDateUtc(DateTime.add(DateTime.nowUnsafe(), { minutes: 5 })),
    });
    const fetch = vi
      .fn<NameraFetch>()
      .mockImplementationOnce(async () =>
        json(Schema.encodeSync(PrepareSignatureResponse)(prepared)),
      )
      .mockImplementation(async (_url, init) => {
        const completion = JSON.parse(new TextDecoder().decode(init?.body as Uint8Array));
        return json({
          namespace: "eip155",
          walletId: request.walletId,
          chainId: request.chainId,
          account: f.binding.walletAddress,
          type: "message",
          signature: pack1271Signature({
            validationSignature: completion.signature,
            validationSignaturePrefix: "0x00",
            entityId: f.binding.entityId,
          }),
        });
      });
    expect((await new NameraClient({ apiKey: "test-only", fetch }).sign(request)).success).toBe(
      true,
    );
    expect(keyring.reads).toHaveBeenCalledOnce();
  });

  it.each(["missing", "locked", "wrong-origin", "wrong-wallet"])(
    "fails closed for %s storage",
    async (mode) => {
      const f = await setup(mode !== "missing");
      keyring.locked = mode === "locked";
      const client = new NameraClient({
        apiKey: "test-only",
        fetch: f.fetch,
        ...(mode === "wrong-origin" ? { baseUrl: "https://other.example" } : {}),
      });
      const result = await client.executions.execute({
        ...f.request,
        ...(mode === "wrong-wallet"
          ? { walletId: f.binding.sessionKeyId as unknown as typeof f.request.walletId }
          : {}),
      });
      expect(result).toMatchObject({
        success: false,
        error: { code: "LOCAL_SIGNER_UNAVAILABLE", cause: null },
      });
      expect(JSON.stringify(result)).not.toContain("private native diagnostic");
      expect(f.fetch).toHaveBeenCalledOnce();
    },
  );

  it("keeps managed executions independent of the key store", async () => {
    const f = await setup(false);
    f.fetch
      .mockReset()
      .mockImplementationOnce(async () =>
        json(
          Schema.encodeSync(PrepareExecutionResponse)({
            ...f.response,
            signing: { method: "server" },
          }),
        ),
      )
      .mockImplementation(async () => json(f.completed));
    keyring.locked = true;
    expect(
      (
        await new NameraClient({ apiKey: "test-only", fetch: f.fetch }).executions.execute(
          f.request,
        )
      ).success,
    ).toBe(true);
    expect(keyring.reads).not.toHaveBeenCalled();
  });

  it("preserves explicit resolvers even when automatic storage is disabled", async () => {
    const f = await setup(false);
    const resolveSessionSigner = vi.fn(async () => ({
      binding: f.binding,
      signMessage: (message: { raw: `0x${string}` }) => f.account.signMessage({ message }),
    }));
    const result = await new NameraClient({
      apiKey: "test-only",
      fetch: f.fetch,
      localSigning: false,
      resolveSessionSigner,
    }).executions.execute(f.request);
    expect(result.success).toBe(true);
    expect(resolveSessionSigner).toHaveBeenCalledOnce();
    expect(keyring.reads).not.toHaveBeenCalled();
  });

  it.each(["disabled", "browser"])("does not read local files in %s mode", async (mode) => {
    const f = await setup();
    const Client = mode === "browser" ? BrowserClient : NameraClient;
    const result = await new Client({
      apiKey: "test-only",
      fetch: f.fetch,
      localSigning: false,
    }).executions.execute(f.request);
    expect(result).toMatchObject({ success: false, error: { code: "LOCAL_SIGNER_REQUIRED" } });
    expect(keyring.reads).not.toHaveBeenCalled();
  });
});
