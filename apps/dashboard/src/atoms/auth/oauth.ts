import type { OAuthAuthorizationRequestId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

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
