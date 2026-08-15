import {
  approveOAuthAuthorizationRequestMutation,
  denyOAuthAuthorizationRequestMutation,
  oauthAuthorizationRequestAtom,
} from "@/atoms/auth/oauth";
import { toMutation, toQuery } from "@/hooks/atom";

export const useOAuthAuthorizationRequest = toQuery(oauthAuthorizationRequestAtom);
export const useApproveOAuthAuthorizationRequest = toMutation(
  approveOAuthAuthorizationRequestMutation,
);
export const useDenyOAuthAuthorizationRequest = toMutation(denyOAuthAuthorizationRequestMutation);
