import {
  approveOAuthAuthorizationRequestMutation,
  denyOAuthAuthorizationRequestMutation,
  oauthAuthorizationRequestAtom,
  oauthDeviceAuthorizationAtom,
  approveOAuthDeviceAuthorizationMutation,
  denyOAuthDeviceAuthorizationMutation,
} from "@/atoms/auth/oauth";
import { toMutation, toQuery } from "@/hooks/atom";

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
