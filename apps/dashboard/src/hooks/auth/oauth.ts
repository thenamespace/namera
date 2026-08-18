import {
  approveOAuthAuthorizationRequestMutation,
  denyOAuthAuthorizationRequestMutation,
  mcpAuthorizationAtom,
  mcpAuthorizationsAtom,
  oauthAuthorizationRequestAtom,
  oauthDeviceAuthorizationAtom,
  approveOAuthDeviceAuthorizationMutation,
  denyOAuthDeviceAuthorizationMutation,
  revokeMcpAuthorizationMutation,
} from "@/atoms/auth/oauth";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useMcpAuthorizations = toQuery(() => mcpAuthorizationsAtom);
export const useMcpAuthorization = toQuery(mcpAuthorizationAtom);
export const useRevokeMcpAuthorization = toMutation(revokeMcpAuthorizationMutation, {
  invalidates: [...QueryKeys.oauth.authorizations],
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
