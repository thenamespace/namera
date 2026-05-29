import { updateUserAtom } from "@/actions";
import { useAtomMutation } from "@/hooks/misc";

export const useUpdateUser = () => {
  return useAtomMutation(updateUserAtom);
};
