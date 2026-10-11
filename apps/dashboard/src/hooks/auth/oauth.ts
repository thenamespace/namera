import {
  approveOAuthAuthorizationRequestMutation,
  approveOAuthDeviceAuthorizationMutation,
  cliAuthorizationAtom,
  cliAuthorizationsAtom,
  mcpAuthorizationAtom,
  mcpAuthorizationsAtom,
  oauthAuthorizationRequestAtom,
  oauthDeviceAuthorizationAtom,
  denyOAuthAuthorizationRequestMutation,
  denyOAuthDeviceAuthorizationMutation,
  revokeCliAuthorizationMutation,
  revokeMcpAuthorizationMutation,
} from "@/atoms/auth/oauth";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useMcpAuthorizations = toQuery(() => mcpAuthorizationsAtom);
export const useMcpAuthorization = toQuery(mcpAuthorizationAtom);
export const useRevokeMcpAuthorization = toMutation(revokeMcpAuthorizationMutation, {
  analyticsAction: "mcp_revoke",
  invalidates: [...QueryKeys.oauth.authorizations],
});

export const useCliAuthorizations = toQuery(() => cliAuthorizationsAtom);
export const useCliAuthorization = toQuery(cliAuthorizationAtom);
export const useRevokeCliAuthorization = toMutation(revokeCliAuthorizationMutation, {
  analyticsAction: "cli_revoke",
  invalidates: [...QueryKeys.oauth.cliAuthorizations],
});

export const useOAuthAuthorizationRequest = toQuery(oauthAuthorizationRequestAtom);
export const useApproveOAuthAuthorizationRequest = toMutation(
  approveOAuthAuthorizationRequestMutation,
  { analyticsAction: "mcp_authorize" },
);
export const useDenyOAuthAuthorizationRequest = toMutation(denyOAuthAuthorizationRequestMutation, {
  analyticsAction: "mcp_deny",
});
export const useOAuthDeviceAuthorization = toQuery(oauthDeviceAuthorizationAtom);
export const useApproveOAuthDeviceAuthorization = toMutation(
  approveOAuthDeviceAuthorizationMutation,
  { analyticsAction: "cli_authorize" },
);
export const useDenyOAuthDeviceAuthorization = toMutation(denyOAuthDeviceAuthorizationMutation, {
  analyticsAction: "cli_deny",
});
