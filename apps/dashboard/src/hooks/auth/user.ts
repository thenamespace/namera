import { updateUserMutation } from "@/atoms/auth/user";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation } from "@/hooks/atom";

export const useUpdateUser = toMutation(updateUserMutation, {
  invalidates: [
    ...QueryKeys.session.current,
    ...QueryKeys.organization.lists,
    ...QueryKeys.member.lists,
  ],
});
