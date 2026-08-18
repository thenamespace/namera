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
  invalidates: [...QueryKeys.oauth.authorizations],
});

export const useCliAuthorizations = toQuery(() => cliAuthorizationsAtom);
export const useCliAuthorization = toQuery(cliAuthorizationAtom);
export const useRevokeCliAuthorization = toMutation(revokeCliAuthorizationMutation, {
  invalidates: [...QueryKeys.oauth.cliAuthorizations],
});

export const useOAuthAuthorizationRequest = toQuery(oauthAuthorizationRequestAtom);
export const useApproveOAuthAuthorizationRequest = toMutation(
  approveOAuthAuthorizationRequestMutation,
);
export const useDenyOAuthAuthorizationRequest = toMutation(denyOAuthAuthorizationRequestMutation);
export const useOAuthDeviceAuthorization = toQuery(oauthDeviceAuthorizationAtom);
export const useApproveOAuthDeviceAuthorization = toMutation(
  approveOAuthDeviceAuthorizationMutation,
);
export const useDenyOAuthDeviceAuthorization = toMutation(denyOAuthDeviceAuthorizationMutation);
