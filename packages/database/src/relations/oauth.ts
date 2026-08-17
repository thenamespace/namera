import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const oauthRelations = defineRelationsPart(schema, (r) => ({
  oauthClient: {
    // One OAuth client can start many authorization requests.
    authorizationRequests: r.many.oauthAuthorizationRequest({
      from: r.oauthClient.id,
      to: r.oauthAuthorizationRequest.clientId,
    }),
    // One OAuth client can receive many approved authorizations.
    authorizations: r.many.oauthAuthorization({
      from: r.oauthClient.id,
      to: r.oauthAuthorization.clientId,
    }),
    // A device client can start many RFC 8628 authorization requests.
    deviceAuthorizations: r.many.oauthDeviceAuthorization({
      from: r.oauthClient.id,
      to: r.oauthDeviceAuthorization.clientId,
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
  oauthAuthorization: {
    // Each authorization belongs to one organization.
    organization: r.one.organization({
      from: r.oauthAuthorization.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each authorization owns one machine actor.
    actor: r.one.actor({
      from: [r.oauthAuthorization.actorId, r.oauthAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // Each authorization belongs to one OAuth client.
    client: r.one.oauthClient({
      from: r.oauthAuthorization.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
    // Each authorization records its approving actor.
    authorizedBy: r.one.actor({
      from: [r.oauthAuthorization.authorizedByActorId, r.oauthAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // A revoked authorization can record its revoking actor.
    revokedBy: r.one.actor({
      from: [r.oauthAuthorization.revokedByActorId, r.oauthAuthorization.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
    // One authorization can issue many one-time codes.
    authorizationCodes: r.many.oauthAuthorizationCode({
      from: [r.oauthAuthorization.id, r.oauthAuthorization.clientId],
      to: [r.oauthAuthorizationCode.authorizationId, r.oauthAuthorizationCode.clientId],
    }),
    // One authorization can issue many access and refresh tokens.
    tokens: r.many.oauthToken({
      from: [r.oauthAuthorization.id, r.oauthAuthorization.clientId],
      to: [r.oauthToken.authorizationId, r.oauthToken.clientId],
    }),
    // A CLI authorization is approved by one device authorization.
    deviceAuthorization: r.one.oauthDeviceAuthorization({
      from: [r.oauthAuthorization.id, r.oauthAuthorization.organizationId],
      to: [r.oauthDeviceAuthorization.authorizationId, r.oauthDeviceAuthorization.organizationId],
    }),
  },
  oauthDeviceAuthorization: {
    // Each device request belongs to the pre-registered CLI client.
    client: r.one.oauthClient({
      from: r.oauthDeviceAuthorization.clientId,
      to: r.oauthClient.id,
      optional: false,
    }),
    // The first signed-in user to open the code owns the consent decision.
    claimedBy: r.one.user({
      from: r.oauthDeviceAuthorization.claimedByUserId,
      to: r.user.id,
    }),
    // Approval binds the request to one organization and authorization.
    organization: r.one.organization({
      from: r.oauthDeviceAuthorization.organizationId,
      to: r.organization.id,
    }),
    authorization: r.one.oauthAuthorization({
      from: [r.oauthDeviceAuthorization.authorizationId, r.oauthDeviceAuthorization.organizationId],
      to: [r.oauthAuthorization.id, r.oauthAuthorization.organizationId],
    }),
  },
  oauthAuthorizationCode: {
    // Each authorization code belongs to one authorization.
    authorization: r.one.oauthAuthorization({
      from: [r.oauthAuthorizationCode.authorizationId, r.oauthAuthorizationCode.clientId],
      to: [r.oauthAuthorization.id, r.oauthAuthorization.clientId],
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
    // Each OAuth token belongs to one authorization.
    authorization: r.one.oauthAuthorization({
      from: [r.oauthToken.authorizationId, r.oauthToken.clientId],
      to: [r.oauthAuthorization.id, r.oauthAuthorization.clientId],
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
