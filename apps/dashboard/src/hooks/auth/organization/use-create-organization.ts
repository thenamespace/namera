import { useRouter } from "@tanstack/react-router";

import { createOrganization } from "@/actions/auth";
import { useAtomMutation } from "@/hooks/misc";

export const useCreateOrganization = () => {
  const router = useRouter();
  const { mutateAsync, ...rest } = useAtomMutation(createOrganization);

  return {
    mutateAsync: async (value: Parameters<typeof mutateAsync>[0]) => {
      await mutateAsync(value);
      await router.invalidate();
    },
    ...rest,
  };
};
