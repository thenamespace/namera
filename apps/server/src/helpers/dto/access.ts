import type { ApiKeyView, OAuthAuthorizationView } from "@namera-ai/application";
import type { ApiKeyResponse, OAuthAuthorizationResponse } from "@namera-ai/protocol/dto";

import { toMemberResponse } from "./auth.js";
import { toSessionKeySummaryResponse } from "./session-key.js";

export const toOAuthAuthorizationResponse = (
  input: OAuthAuthorizationView,
): OAuthAuthorizationResponse => ({
  id: input.authorization.id,
  organizationId: input.authorization.organizationId,
  actorId: input.authorization.actorId,
  type: input.authorization.type,
  client: {
    id: input.client.id,
    clientId: input.client.clientId,
    registrationType: input.client.registrationType,
    clientName: input.client.clientName,
    clientUri: input.client.clientUri,
    logoUri: input.client.logoUri,
  },
  authorizedBy: toMemberResponse(input.authorizedBy),
  scopes: input.authorization.scopes,
  resource: input.authorization.resource,
  status: input.authorization.status,
  metadata: input.authorization.metadata,
  expiresAt: input.authorization.expiresAt,
  lastUsedAt: input.authorization.lastUsedAt,
  revokedAt: input.authorization.revokedAt,
  sessionKeys: input.sessionKeys.map(toSessionKeySummaryResponse),
  createdAt: input.authorization.createdAt,
  updatedAt: input.authorization.updatedAt,
});

export const toApiKeyResponse = (input: ApiKeyView): ApiKeyResponse => ({
  id: input.apiKey.id,
  organizationId: input.apiKey.organizationId,
  actorId: input.apiKey.actorId,
  metadata: input.apiKey.metadata,
  keyStart: input.apiKey.keyStart,
  expiresAt: input.apiKey.expiresAt,
  lastUsedAt: input.apiKey.lastUsedAt,
  revokedAt: input.apiKey.revokedAt,
  createdAt: input.apiKey.createdAt,
  updatedAt: input.apiKey.updatedAt,
  sessionKeys: input.sessionKeys.map(toSessionKeySummaryResponse),
  creator: toMemberResponse(input.creator),
});
