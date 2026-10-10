import { ConfigProvider, Layer, Schema } from "effect";

import {
  OneClawCustomerAuthority,
  OneClawOwnerProvisioningRequest,
  OneClawOrganizationSetupRequest,
} from "@namera-ai/protocol/model";
import { privateKeyToAccount } from "viem/accounts";
import { vi } from "vitest";

import { OneClawService } from "../../src/index.js";

export const Live = OneClawService.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        ONECLAW_PLATFORM_APP_ID: "test-app",
        ONECLAW_PLATFORM_API_KEY: "synthetic-platform-key",
        ONECLAW_EMPTY_TEMPLATE_ID: "empty-template",
        ONECLAW_EMPTY_TEMPLATE_VERSION: 1,
      }),
    ),
  ),
);
export const orgId = "01950000-0000-7000-8000-000000000001";
export const credentialId = "01950000-0000-7000-8000-000000000002";
export const localConnectionId = "01950000-0000-7000-8000-000000000003";
export const signerId = "01950000-0000-7000-8000-000000000004";
export const connection = {
  id: localConnectionId,
  organizationId: orgId,
  provider: "1claw",
  providerAppId: "test-app",
  externalConnectionId: "connection",
  customerCredentialId: credentialId,
  status: "ready",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  data: {
    version: 1,
    customerId: "customer",
    oidcSubject: `namera:org:${orgId}`,
    email: "org@example.invalid",
    bootstrapCompletedAt: "2026-01-01T00:00:00Z",
    delegationEnabledAt: "2026-01-01T00:00:00Z",
  },
};
const binding = {
  providerConnectionId: localConnectionId,
  providerAppId: "test-app",
  externalConnectionId: "connection",
  customerId: "customer",
};
export const authority = Schema.decodeUnknownSync(OneClawCustomerAuthority)({
  connection,
  credential: {
    id: credentialId,
    organizationId: orgId,
    type: "1claw-customer",
    data: { version: 1, ...binding },
    encryptedPayload: "synthetic-ciphertext",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  },
  payload: {
    version: 1,
    credentialId,
    organizationId: orgId,
    ...binding,
    expiresAt: "2099-01-01T00:00:00Z",
    token: "synthetic-customer-token",
  },
});
export const provisioning = Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)({
  connection,
  signingKeyId: signerId,
  agentCredentialId: signerId,
});
export const setup = Schema.decodeUnknownSync(OneClawOrganizationSetupRequest)({
  connection: {
    ...connection,
    status: "pending",
    customerCredentialId: null,
    data: { ...connection.data, bootstrapCompletedAt: null, delegationEnabledAt: null },
  },
});

// Publicly known test scalar, never used with a live provider or real funds.
export const account = privateKeyToAccount(`0x${"01".repeat(32)}`);
export const agent = {
  id: "agent",
  is_active: true,
  intents_api_enabled: true,
  raw_signing_enabled: true,
  raw_signing_policy: "allow",
};
export const key = {
  id: "key",
  agent_id: "agent",
  chain: "ethereum",
  curve: "secp256k1",
  public_key: account.publicKey,
  address: account.address,
  key_version: 1,
  is_active: true,
  custody: "server",
};
export const template = {
  id: "empty-template",
  platform_app_id: "test-app",
  version: 1,
  is_active: true,
  spec: {},
};
export const remoteConnection = {
  connection_id: "connection",
  user_id: "customer",
  status: "active",
};
export const claim = {
  connection_id: "connection",
  claim_token: "synthetic-claim",
  expires_in: 600,
};

export const fetchMock = vi.fn<typeof fetch>();
export const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
export const identity = () => respond({ id: "customer" });
export const requestAt = (index: number): { url: string; headers: Headers; body: unknown } => {
  const call = fetchMock.mock.calls[index];
  if (call === undefined) throw new Error("Expected SDK request was not made");
  const [url, init] = call;
  return {
    url: String(url),
    headers: new Headers(init?.headers),
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
};
