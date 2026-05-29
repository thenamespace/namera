import { useContext } from "react";

import { useRouter } from "@tanstack/react-router";

import { RegistryContext } from "@effect/atom-react";

import { createOrganization } from "@/actions/auth";
import { useAtomMutation } from "@/hooks/misc";
import { authAtoms, refreshAtomData } from "@/lib/atom";

export const useCreateOrganization = () => {
  const router = useRouter();
  const atomRegistry = useContext(RegistryContext);
  const { mutateAsync, ...rest } = useAtomMutation(createOrganization);

  return {
    mutateAsync: async (value: Parameters<typeof mutateAsync>[0]) => {
      await mutateAsync(value);
      await Promise.all([
        refreshAtomData(atomRegistry, authAtoms.me),
        refreshAtomData(atomRegistry, authAtoms.organization.listOrgsForUser),
      ]);
      await router.invalidate();
    },
    ...rest,
  };
};
