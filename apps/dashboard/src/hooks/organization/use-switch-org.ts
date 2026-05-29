import { useRouter } from "@tanstack/react-router";

import { switchOrganization } from "@/actions";

import { useAtomMutation } from "../misc";

export const useSwitchOrg = () => {
  const { mutateAsync, ...rest } = useAtomMutation(switchOrganization);
  const router = useRouter();

  return {
    mutateAsync: async (value: Parameters<typeof mutateAsync>[0]) => {
      await mutateAsync(value);
      await router.invalidate();
    },
    ...rest,
  };
};
