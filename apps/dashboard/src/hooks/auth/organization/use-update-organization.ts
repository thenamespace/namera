import { useContext } from "react";

import { RegistryContext } from "@effect/atom-react";

import { updateOrganization } from "@/actions/auth";
import { useAtomMutation } from "@/hooks/misc";
import { authAtoms, refreshAtomData } from "@/lib/atom";

export const useUpdateOrganization = () => {
  const atomRegistry = useContext(RegistryContext);
  const { mutateAsync, ...rest } = useAtomMutation(updateOrganization);

  return {
    mutateAsync: async (value: Parameters<typeof mutateAsync>[0]) => {
      await mutateAsync(value);
      await Promise.all([
        refreshAtomData(atomRegistry, authAtoms.me),
        refreshAtomData(atomRegistry, authAtoms.organization.listOrgsForUser),
      ]);
    },
    ...rest,
  };
};
