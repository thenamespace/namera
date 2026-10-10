import { Redacted, Schema } from "effect";

import { describe, expect, it } from "vitest";

import { WalletOwnerResponse } from "../../../src/dto/wallet/index.js";
import { ProviderConnectionError } from "../../../src/errors/index.js";
import {
  CredentialInsert,
  OneClawCustomerAuthority,
  OneClawOwnerProvisioningRequest,
  OneClawProvisionedOwnerAgent,
  ProviderConnection,
} from "../../../src/model/index.js";

const id = "01950000-0000-7000-8000-000000000001";
const organizationId = "01950000-0000-7000-8000-000000000002";
const credentialId = "01950000-0000-7000-8000-000000000003";
const otherId = "01950000-0000-7000-8000-000000000004";
const instant = "2026-10-10T00:00:00.000Z";
const connection = {
  id,
  organizationId,
  provider: "1claw",
  providerAppId: "test-app",
  externalConnectionId: "test-connection",
  customerCredentialId: credentialId,
  status: "ready",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  data: {
    version: 1,
    customerId: "test-customer",
    oidcSubject: `namera:org:${organizationId}`,
    email: "test-org@example.invalid",
    bootstrapCompletedAt: instant,
    delegationEnabledAt: instant,
  },
};
const binding = {
  providerConnectionId: id,
  providerAppId: connection.providerAppId,
  externalConnectionId: connection.externalConnectionId,
  customerId: connection.data.customerId,
};
const credential = {
  id: credentialId,
  organizationId,
  type: "1claw-customer",
  data: { version: 1, ...binding },
  encryptedPayload: "synthetic-ciphertext",
  expiresAt: new Date(instant),
};
const payload = {
  version: 1,
  credentialId,
  organizationId,
  ...binding,
  expiresAt: instant,
  token: "synthetic-customer-token",
};
const authority = { connection, credential, payload };

describe("provider connection and customer authority", () => {
  it("round trips connection and encrypted credentials without discarding expiration", () => {
    expect(
      Schema.encodeSync(ProviderConnection)(
        Schema.decodeUnknownSync(ProviderConnection)(connection),
      ),
    ).toEqual(connection);
    expect(
      Schema.encodeSync(CredentialInsert)(Schema.decodeUnknownSync(CredentialInsert)(credential)),
    ).toEqual(credential);
    const decoded = Schema.decodeUnknownSync(OneClawCustomerAuthority)(authority);
    expect(Redacted.value(decoded.payload.token)).toBe(payload.token);
    expect(JSON.stringify(decoded)).not.toContain(payload.token);
  });

  it.each([
    { ...connection, customerCredentialId: null },
    { ...connection, data: { ...connection.data, bootstrapCompletedAt: null } },
    { ...connection, data: { ...connection.data, delegationEnabledAt: null } },
    { ...connection, data: { ...connection.data, email: "not-email" } },
    { ...connection, provider: "unimplemented-provider" },
    { ...connection, externalConnectionId: "" },
  ])("rejects incomplete readiness or invalid identity", (value) => {
    expect(() => Schema.decodeUnknownSync(ProviderConnection)(value)).toThrow();
  });

  it("allows pending setup without implying usable customer authority", () => {
    const pending = {
      ...connection,
      status: "pending",
      customerCredentialId: null,
      data: { ...connection.data, bootstrapCompletedAt: null, delegationEnabledAt: null },
    };
    expect(() => Schema.decodeUnknownSync(ProviderConnection)(pending)).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawCustomerAuthority)({ ...authority, connection: pending }),
    ).toThrow();
  });

  it.each([
    { organizationId: otherId },
    { credentialId: otherId },
    { providerConnectionId: otherId },
    { providerAppId: "other-app" },
    { externalConnectionId: "other-connection" },
    { customerId: "other-customer" },
    { expiresAt: "2026-10-11T00:00:00.000Z" },
    { token: "" },
    { customerId: undefined },
  ])("rejects substituted or missing decrypted authority bindings", (change) => {
    expect(() =>
      Schema.decodeUnknownSync(OneClawCustomerAuthority)({
        ...authority,
        payload: { ...payload, ...change },
      }),
    ).toThrow();
  });

  it("rejects disabled connections and substituted credential rows", () => {
    expect(() =>
      Schema.decodeUnknownSync(OneClawCustomerAuthority)({
        ...authority,
        connection: { ...connection, status: "disabled" },
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawCustomerAuthority)({
        ...authority,
        credential: { ...credential, organizationId: otherId },
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawCustomerAuthority)({
        ...authority,
        credential: { ...credential, data: { ...credential.data, customerId: "other" } },
      }),
    ).toThrow();
  });

  it.each([
    { ...credential, expiresAt: undefined },
    { ...credential, expiresAt: new Date("invalid") },
    { ...credential, type: "1claw-agent" },
    { ...credential, data: { version: 1, agentId: "agent" } },
  ])("does not confuse customer and agent credential shapes", (value) => {
    expect(() => Schema.decodeUnknownSync(CredentialInsert)(value)).toThrow();
  });

  it("keeps connection and authority fields out of the public owner projection", () => {
    const safe = {
      signingKeyId: id,
      custody: "namera-managed",
      provider: "1claw",
      algorithm: "secp256k1",
    };
    expect(
      Schema.decodeUnknownSync(WalletOwnerResponse)({
        ...safe,
        ...authority,
        token: payload.token,
      }),
    ).toEqual(safe);
  });
});

describe("1Claw provisioning contracts", () => {
  const request = {
    mode: "incremental",
    signingKeyId: otherId,
    agentCredentialId: otherId,
    connection,
  };
  it("separates first bootstrap from incremental account creation", () => {
    expect(() => Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)(request)).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)({
        ...request,
        mode: "bootstrap",
        templateId: "template",
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)({
        ...request,
        templateId: "template",
      }),
    ).toThrow();
    const first = {
      ...request,
      mode: "bootstrap",
      templateId: "template",
      connection: {
        ...connection,
        status: "pending",
        customerCredentialId: null,
        data: { ...connection.data, bootstrapCompletedAt: null, delegationEnabledAt: null },
      },
    };
    expect(() => Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)(first)).not.toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OneClawOwnerProvisioningRequest)({
        ...first,
        templateId: undefined,
      }),
    ).toThrow();
  });

  it("binds the early one-time agent credential to the requested organization and ID", () => {
    const result = {
      request,
      credential: {
        version: 1,
        credentialId: otherId,
        organizationId,
        agentId: "agent",
        apiKey: "synthetic-agent-key",
      },
    };
    expect(() => Schema.decodeUnknownSync(OneClawProvisionedOwnerAgent)(result)).not.toThrow();
    for (const change of [{ organizationId: otherId }, { credentialId }]) {
      expect(() =>
        Schema.decodeUnknownSync(OneClawProvisionedOwnerAgent)({
          ...result,
          credential: { ...result.credential, ...change },
        }),
      ).toThrow();
    }
  });

  it("uses bounded internal failures without encoding arbitrary provider error bodies", () => {
    const error = Schema.decodeUnknownSync(ProviderConnectionError)({
      _tag: "ProviderConnectionError",
      code: "LINK_REQUIRED",
      token: payload.token,
    });
    expect(JSON.stringify(Schema.encodeSync(ProviderConnectionError)(error))).not.toContain(
      payload.token,
    );
    expect(() =>
      Schema.decodeUnknownSync(ProviderConnectionError)({
        _tag: "ProviderConnectionError",
        code: "unknown",
      }),
    ).toThrow();
  });
});
