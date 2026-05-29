import { updateUserPreferences } from "@/actions";
import { useAtomMutation } from "@/hooks/misc";

export const useUpdateUserPreference = () => {
  return useAtomMutation(updateUserPreferences);
};
