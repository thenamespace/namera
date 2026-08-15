import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const oauthRelations = defineRelationsPart(schema, (r) => ({
  oauthClient: {
    // One OAuth client can start many authorization requests.
    authorizationRequests: r.many.oauthAuthorizationRequest({
      from: r.oauthClient.id,
      to: r.oauthAuthorizationRequest.clientId,
    }),
    // One OAuth client can receive many approved MCP authorizations.
    authorizations: r.many.mcpAuthorization({
      from: r.oauthClient.id,
      to: r.mcpAuthorization.clientId,
    }),
    // One OAuth client can receive many one-time authorization codes.
    authorizationCodes: r.many.oauthAuthorizationCode({
      from: r.oauthClient.id,
      to: r.oauthAuthorizationCode.clientId,
    }),
    // One OAuth client can receive many access and refresh tokens.
    tokens: r.many.oauthToken({ from: r.oauthClient.id, to: r.oauthToken.clientId }),
  },
  oauthAuthorizationRequest: {
    // Each authorization request belongs to one OAuth client.
    client: r.one.oauthClient({
      from: r.oauthAuthorizationRequest.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
    // An authorization request can record its consenting user.
    user: r.one.user({ from: r.oauthAuthorizationRequest.userId, to: r.user.id }),
    // An authorization request can record its selected organization.
    organization: r.one.organization({
      from: r.oauthAuthorizationRequest.organizationId,
      to: r.organization.id,
    }),
  },
  mcpAuthorization: {
    // Each MCP authorization belongs to one organization.
    organization: r.one.organization({
      from: r.mcpAuthorization.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each MCP authorization owns one MCP actor.
    actor: r.one.actor({
      from: [r.mcpAuthorization.actorId, r.mcpAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // Each MCP authorization belongs to one OAuth client.
    client: r.one.oauthClient({
      from: r.mcpAuthorization.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
    // Each MCP authorization records its approving actor.
    authorizedBy: r.one.actor({
      from: [r.mcpAuthorization.authorizedByActorId, r.mcpAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // A revoked MCP authorization can record its revoking actor.
    revokedBy: r.one.actor({
      from: [r.mcpAuthorization.revokedByActorId, r.mcpAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
    // One MCP authorization can issue many one-time codes.
    authorizationCodes: r.many.oauthAuthorizationCode({
      from: [r.mcpAuthorization.id, r.mcpAuthorization.clientId],
      to: [r.oauthAuthorizationCode.authorizationId, r.oauthAuthorizationCode.clientId],
    }),
    // One MCP authorization can issue many access and refresh tokens.
    tokens: r.many.oauthToken({
      from: [r.mcpAuthorization.id, r.mcpAuthorization.clientId],
      to: [r.oauthToken.authorizationId, r.oauthToken.clientId],
    }),
  },
  oauthAuthorizationCode: {
    // Each authorization code belongs to one MCP authorization.
    authorization: r.one.mcpAuthorization({
      from: [r.oauthAuthorizationCode.authorizationId, r.oauthAuthorizationCode.clientId],
      to: [r.mcpAuthorization.id, r.mcpAuthorization.clientId],
      optional: false,
    }),
    // Each authorization code belongs to one OAuth client.
    client: r.one.oauthClient({
      from: r.oauthAuthorizationCode.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
  },
  oauthToken: {
    // Each OAuth token belongs to one MCP authorization.
    authorization: r.one.mcpAuthorization({
      from: [r.oauthToken.authorizationId, r.oauthToken.clientId],
      to: [r.mcpAuthorization.id, r.mcpAuthorization.clientId],
      optional: false,
    }),
    // Each OAuth token belongs to one OAuth client.
    client: r.one.oauthClient({
      from: r.oauthToken.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
    // A rotated refresh token can reference its parent token.
    parent: r.one.oauthToken({ from: r.oauthToken.parentId, to: r.oauthToken.id }),
    // One refresh token can have many replacement children over its history.
    children: r.many.oauthToken({ from: r.oauthToken.id, to: r.oauthToken.parentId }),
  },
}));
