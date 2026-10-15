import { Schema } from "effect";

import {
  CreateSessionKeyRequest,
  CreateWalletRequest,
  PasskeyRegistrationOptionsResponse,
  PrepareManagedSessionKeyOperationResponse,
  PrepareSessionKeyOperationResponse,
  SessionKeyResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { describe, expect, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../../../src/index.js";
import { jsonResponse } from "../../fixtures/http.js";
import fixtures from "../../fixtures/provisioning.json";

const walletId = fixtures.wallet.id;
const sessionKeyId = fixtures.managedSession.id;
const operationId = fixtures.managedPreparation.operationId;
const target = { sessionKeyId, chainId: "eip155:11155111", kind: "install" } as const;
const sessionRequest = {
  namespace: "eip155",
  walletId,
  metadata: { version: 1, name: "Backend session" },
  signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
  onchain: {
    installations: [
      {
        chainId: target.chainId,
        validAfter: 0,
        validUntil: 2_000_000_000,
        permissions: [{ type: "native-token-transfer", allowance: 10n }],
        allowSignatures: false,
      },
    ],
  },
  policies: [],
} as const;
const bodies = (fetch: ReturnType<typeof vi.fn<NameraFetch>>) =>
  fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

describe("SDK wallet and session management", () => {
  it("keeps captured public response fixtures compatible with protocol schemas", () => {
    Schema.decodeUnknownSync(Schema.toCodecJson(WalletResponse))(fixtures.wallet);
    Schema.decodeUnknownSync(Schema.toCodecJson(WalletResponse))(fixtures.passkeyWallet);
    for (const session of [
      fixtures.localSession,
      fixtures.managedSession,
      fixtures.passkeySession,
      fixtures.revokingSession,
    ])
      Schema.decodeUnknownSync(Schema.toCodecJson(SessionKeyResponse))(session);
    Schema.decodeUnknownSync(Schema.toCodecJson(PrepareManagedSessionKeyOperationResponse))(
      fixtures.managedPreparation,
    );
    Schema.decodeUnknownSync(Schema.toCodecJson(PrepareSessionKeyOperationResponse))(
      fixtures.passkeyPreparation,
    );
    Schema.decodeUnknownSync(Schema.toCodecJson(PrepareManagedSessionKeyOperationResponse))(
      fixtures.uninstallPreparation,
    );
    Schema.decodeUnknownSync(Schema.toCodecJson(PasskeyRegistrationOptionsResponse))(
      fixtures.registration,
    );
  });

  it.each(["wallet", "session"] as const)(
    "generates one private idempotency key per %s creation and preserves it across retries",
    async (resource) => {
      const response = resource === "wallet" ? fixtures.wallet : fixtures.managedSession;
      const fetch = vi
        .fn<NameraFetch>()
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockImplementation(async () => jsonResponse(response, 201));
      const client = new NameraClient({ apiKey: "test-key", fetch });
      const create = () =>
        resource === "wallet"
          ? client.wallets.create({
              namespace: "eip155",
              metadata: { version: 1, name: "Account" },
              owner: { type: "namera-managed", provider: "1claw" },
            })
          : client.sessionKeys.create(sessionRequest);
      expect((await create()).success).toBe(true);
      const [first, retry] = bodies(fetch);
      expect(first.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
      expect(retry.idempotencyKey).toBe(first.idempotencyKey);
      Schema.decodeUnknownSync(
        resource === "wallet" ? CreateWalletRequest : CreateSessionKeyRequest,
      )(first);
      expect((await create()).success).toBe(true);
      expect(bodies(fetch)[2].idempotencyKey).not.toBe(first.idempotencyKey);
    },
  );

  it.each(["1claw", "passkey"] as const)(
    "selects the %s preparation endpoint and normalizes approval",
    async (owner) => {
      const session = owner === "1claw" ? fixtures.managedSession : fixtures.passkeySession;
      const response =
        owner === "1claw" ? fixtures.managedPreparation : fixtures.passkeyPreparation;
      const fetch = vi
        .fn<NameraFetch>()
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse(response));
      const client = new NameraClient({ apiKey: "test-key", fetch });
      const result = await client.sessionKeys.prepareOperation({
        ...target,
        sessionKeyId: session.id,
      });
      expect(result).toMatchObject({ success: true, data: { approval: owner } });
      expect(String(fetch.mock.calls[1]?.[0])).toContain(
        owner === "1claw" ? "/operations/managed/prepare" : "/operations/prepare",
      );
      const first = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body));
      const retry = JSON.parse(String(fetch.mock.calls[2]?.[1]?.body));
      expect(first).toEqual(retry);
      expect(first).toMatchObject({ sponsor: true, installationId: session.installations[0]?.id });
    },
  );

  it("recovers an unsigned operation using the stored key without exposing it", async () => {
    const session = fixtures.managedSession;
    const installation = session.installations[0];
    if (installation === undefined) throw new Error("Expected a fixture installation");
    const fetch = vi
      .fn<NameraFetch>()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(
        jsonResponse({
          operation: {
            operationId,
            status: "awaiting-signature",
            retryRequest: {
              installationId: installation.id,
              kind: "install",
              sponsor: true,
              idempotencyKey: "stored-request",
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(fixtures.managedPreparation));
    const result = await new NameraClient({
      apiKey: "test-key",
      fetch,
    }).sessionKeys.getActiveOperation(target);
    expect(result).toMatchObject({
      success: true,
      data: { operation: { operationId, preparation: { approval: "1claw" } } },
    });
    expect(
      JSON.stringify(result, (_, value) => (typeof value === "bigint" ? String(value) : value)),
    ).not.toContain("stored-request");
    expect(JSON.parse(String(fetch.mock.calls[2]?.[1]?.body)).idempotencyKey).toBe(
      "stored-request",
    );
  });

  it("retries approval with the same operation, and validates inputs before requests", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ operationId, status: "signed" }));
    const client = new NameraClient({ apiKey: "test-key", fetch });
    expect(
      (await client.sessionKeys.approveOperation({ operationId, approval: { type: "1claw" } }))
        .success,
    ).toBe(true);
    expect(bodies(fetch)).toEqual([{ operationId }, { operationId }]);
    fetch.mockClear();
    expect(
      await client.sessionKeys.prepareOperation({ ...target, sessionKeyId: "invalid" }),
    ).toMatchObject({ success: false, error: { kind: "contract" } });
    expect(await client.wallets.getPasskeyOwner("invalid")).toMatchObject({
      success: false,
      error: { kind: "contract" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects recovery redirected to a different installation before preparing it", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockResolvedValueOnce(jsonResponse(fixtures.managedSession))
      .mockResolvedValueOnce(
        jsonResponse({
          operation: {
            operationId,
            status: "awaiting-signature",
            retryRequest: {
              installationId: "0199dfe1-0000-7000-8000-000000000999",
              kind: "install",
              sponsor: true,
              idempotencyKey: "foreign-request",
            },
          },
        }),
      );
    const result = await new NameraClient({
      apiKey: "test-key",
      fetch,
    }).sessionKeys.getActiveOperation(target);
    expect(result).toMatchObject({ success: false, error: { kind: "contract" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("forwards the complete passkey assertion to the passkey completion endpoint", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockResolvedValue(jsonResponse({ operationId, status: "signed" }));
    const response = {
      id: "dGVzdA",
      rawId: "dGVzdA",
      type: "public-key" as const,
      response: { clientDataJSON: "dGVzdA", authenticatorData: "dGVzdA", signature: "dGVzdA" },
      clientExtensionResults: {},
    };
    const result = await new NameraClient({
      apiKey: "test-key",
      fetch,
    }).sessionKeys.approveOperation({ operationId, approval: { type: "passkey", response } });
    expect(result).toMatchObject({ success: true, data: { status: "signed" } });
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/operations/complete");
    expect(bodies(fetch)).toEqual([{ operationId, response }]);
  });

  it("does not retry passkey ceremony generation after a transient response", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(jsonResponse({}, 503));
    const result = await new NameraClient({
      apiKey: "test-key",
      fetch,
    }).wallets.createPasskeyRegistrationOptions({
      origin: "https://app.example.com",
      user: { name: "Customer", displayName: "Customer" },
    });
    expect(result.success).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
    expect(bodies(fetch)).toEqual([
      { origin: "https://app.example.com", user: { name: "Customer", displayName: "Customer" } },
    ]);
  });
});
