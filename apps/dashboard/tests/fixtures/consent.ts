import { Schema } from "effect";

import {
  GetOAuthAuthorizationRequestResponse,
  OAuthDeviceAuthorizationResponse,
  SessionKeyResponse,
  WalletResponse,
  GetOrganizationMemberResponse,
} from "@namera-ai/protocol/dto";

import { actor } from "./actor.js";
import { managedWallet } from "./wallet-transaction.js";

const client = {
  id: "01950000-0000-7000-8000-000000000010",
  clientId: "review-client",
  registrationType: "pre-registered",
  clientName: "Review client",
  clientUri: null,
  logoUri: null,
};
const requestedScopes = ["wallet:read", "execution:execute", "offline_access"];
const expiresAt = new Date("2026-10-01T12:05:00Z");

export const oauthRequest = Schema.decodeUnknownSync(GetOAuthAuthorizationRequestResponse)({
  id: "01950000-0000-7000-8000-000000000011",
  client,
  redirectUri: "https://client.example/callback",
  resource: "https://api.example",
  requestedScopes,
  expiresAt,
  createdAt: new Date("2026-10-01T12:00:00Z"),
});

export const cliRequest = Schema.decodeUnknownSync(OAuthDeviceAuthorizationResponse)({
  id: "01950000-0000-7000-8000-000000000012",
  client,
  requestedScopes,
  resource: "https://api.example",
  userCode: "ABCD-EFGH",
  deviceName: "Review laptop",
  cliVersion: "1.0.0",
  platform: "darwin",
  expiresAt,
});

export const consentSession = Schema.decodeUnknownSync(SessionKeyResponse)({
  id: "01950000-0000-7000-8000-000000000013",
  organizationId: managedWallet.organizationId,
  walletId: managedWallet.id,
  signingKeyId: "01950000-0000-7000-8000-000000000014",
  namespace: "eip155",
  metadata: { version: 1, name: "Trading session" },
  policies: [],
  policyHash: "review-policy",
  status: "active",
  revokedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  signer: { custody: "local", algorithm: "secp256k1", publicKey: "0x1234" },
  wallet: Schema.encodeSync(WalletResponse)(managedWallet),
  creator: Schema.encodeSync(GetOrganizationMemberResponse)(actor.member),
  installations: [],
});

export const revokedConsentSession = Schema.decodeUnknownSync(SessionKeyResponse)({
  ...Schema.encodeSync(SessionKeyResponse)(consentSession),
  id: "01950000-0000-7000-8000-000000000015",
  status: "revoked",
  metadata: { version: 1, name: "Revoked session" },
  revokedAt: new Date("2026-10-01T01:00:00Z"),
});
