import { Schema } from "effect";

import {
  ApiKeyResponse,
  GetDashboardOverviewResponse,
  UserActorData,
  type SessionKeyResponse,
} from "@namera-ai/protocol/dto";

import { actor } from "./actor";
import { newestSessionAccount, registeredPresetSession } from "./session-key-preset";

export function setupSessionKey(
  installationStatus: SessionKeyResponse["installations"][number]["status"] = "installed",
): SessionKeyResponse {
  const sessionKey = registeredPresetSession({
    namespace: "eip155",
    walletId: newestSessionAccount.id,
    metadata: { version: 1, name: "My first session key" },
    signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
    policies: [],
    onchain: {
      installations: [
        {
          chainId: "eip155:8453",
          validAfter: 0,
          validUntil: 2_000_000_000,
          permissions: [{ type: "root" }],
          allowSignatures: true,
        },
      ],
    },
  });
  const [installation] = sessionKey.installations;
  if (!installation) throw new Error("Expected a session installation fixture");

  return {
    ...sessionKey,
    organizationId: actor.organization.id,
    wallet: { ...sessionKey.wallet, organizationId: actor.organization.id },
    status: installationStatus === "installed" ? "active" : "pending",
    installations: [{ ...installation, status: installationStatus }],
  };
}

export const setupActor = Schema.decodeUnknownSync(Schema.toType(UserActorData))({
  ...actor,
  role: {
    ...actor.role,
    permissions: [
      "wallet:read",
      "wallet:create",
      "session-key:read",
      "session-key:create",
      "execution:read",
      "billing:read",
      "api-key:read",
      "api-key:create",
      "cli-authorization:read",
      "mcp-authorization:read",
    ],
  },
});

export function setupApiKey(used = false) {
  return Schema.decodeUnknownSync(ApiKeyResponse)({
    id: "01950000-0000-7000-8000-000000000009",
    organizationId: actor.organization.id,
    actorId: actor.actorId,
    metadata: { version: 1, name: "Example integration" },
    permissions: [],
    passkeyOrigins: [],
    keyStart: "namera-example",
    expiresAt: null,
    lastUsedAt: used ? new Date("2026-10-01T00:00:00Z") : null,
    revokedAt: null,
    sessionKeys: [],
    creator: Schema.encodeSync(UserActorData)(actor).member,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  });
}

export function setupOverview({
  accounts = 0,
  sessionKeys = 0,
  executions = 0,
  signatures = 0,
  source = "user",
}: {
  accounts?: number;
  sessionKeys?: number;
  executions?: number;
  signatures?: number;
  source?: "user" | "api-key" | "cli" | "mcp";
} = {}): GetDashboardOverviewResponse {
  return Schema.decodeUnknownSync(GetDashboardOverviewResponse)({
    organizationId: actor.organization.id,
    resources: {
      accounts: { total: accounts, active: accounts },
      sessionKeys: { total: sessionKeys, active: sessionKeys },
    },
    namespaces: [
      {
        namespace: "eip155",
        totals: { executions: String(executions), signatures: String(signatures) },
        activity: {
          daily: { granularity: "day", points: [] },
          weekly: { granularity: "week", points: [] },
          monthly: { granularity: "month", points: [] },
        },
        executionSources: executions > 0 ? [{ actorType: source, count: executions }] : [],
      },
    ],
  });
}
