import { updateOrganization } from "@/actions/auth";
import { useAtomMutation } from "@/hooks/misc";

export const useUpdateOrganization = () => {
  return useAtomMutation(updateOrganization);
};
