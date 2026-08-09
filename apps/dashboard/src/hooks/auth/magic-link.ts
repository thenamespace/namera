import { requestMagicLinkMutation, verifyMagicLinkMutation } from "@/atoms/auth/magic-link";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation } from "@/hooks/atom";

export const useRequestMagicLink = toMutation(requestMagicLinkMutation);

export const useVerifyMagicLink = toMutation(verifyMagicLinkMutation, {
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.session.lists,
    ...QueryKeys.organization.active,
    ...QueryKeys.organization.lists,
  ],
});
