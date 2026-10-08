import {
  googleConfigurationAtom,
  startGoogleMutation,
  requestMagicLinkMutation,
  verifyMagicLinkMutation,
  logoutMutation,
} from "@/atoms/auth";
import { toMutation, toQuery } from "@/hooks/atom";

export const useGoogleConfiguration = toQuery(() => googleConfigurationAtom);
export const useStartGoogle = toMutation(startGoogleMutation);
export const useRequestMagicLink = toMutation(requestMagicLinkMutation);
export const useVerifyMagicLink = toMutation(verifyMagicLinkMutation);
export const useLogout = toMutation(logoutMutation);
