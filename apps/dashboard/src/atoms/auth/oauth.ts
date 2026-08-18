import type { OAuthAuthorizationId, OAuthAuthorizationRequestId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const mcpAuthorizationsAtom = NameraClient.query("oauth", "listMcpAuthorizations", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.oauth.authorizations,
    ...QueryKeys.oauth.authorizationLists,
  ],
  timeToLive: "30 seconds",
});

export const mcpAuthorizationAtom = (authorizationId: OAuthAuthorizationId) =>
  NameraClient.query("oauth", "getMcpAuthorization", {
    params: { authorizationId },
    reactivityKeys: [
      ...QueryKeys.organization.active,
      ...QueryKeys.oauth.authorizations,
      ...QueryKeys.oauth.authorizationDetails,
      ...QueryKeys.oauth.authorization(authorizationId),
    ],
    timeToLive: "30 seconds",
  });

export const revokeMcpAuthorizationMutation = NameraClient.mutation(
  "oauth",
  "revokeMcpAuthorization",
);

export const oauthAuthorizationRequestAtom = (requestId: OAuthAuthorizationRequestId) =>
  NameraClient.query("oauth", "getOAuthAuthorizationRequest", {
    params: { requestId },
    reactivityKeys: [
      ...QueryKeys.oauth.authorizationRequests,
      ...QueryKeys.oauth.authorizationRequest(requestId),
    ],
    timeToLive: "30 seconds",
  });

export const approveOAuthAuthorizationRequestMutation = NameraClient.mutation(
  "oauth",
  "approveOAuthAuthorizationRequest",
);

export const denyOAuthAuthorizationRequestMutation = NameraClient.mutation(
  "oauth",
  "denyOAuthAuthorizationRequest",
);

export const oauthDeviceAuthorizationAtom = (userCode: string) =>
  NameraClient.query("oauth", "getOAuthDeviceAuthorization", {
    query: { userCode },
    reactivityKeys: QueryKeys.oauth.deviceAuthorizations,
    timeToLive: "10 seconds",
  });

export const approveOAuthDeviceAuthorizationMutation = NameraClient.mutation(
  "oauth",
  "approveOAuthDeviceAuthorization",
);

export const denyOAuthDeviceAuthorizationMutation = NameraClient.mutation(
  "oauth",
  "denyOAuthDeviceAuthorization",
);
