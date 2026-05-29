import { useContext } from "react";

import { useRouter } from "@tanstack/react-router";

import { RegistryContext } from "@effect/atom-react";

import { switchOrganization } from "@/actions";
import { authAtoms, refreshAtomData } from "@/lib/atom";

import { useAtomMutation } from "../misc";

export const useSwitchOrg = () => {
  const { mutateAsync, ...rest } = useAtomMutation(switchOrganization);
  const router = useRouter();
  const atomRegistry = useContext(RegistryContext);

  return {
    mutateAsync: async (value: Parameters<typeof mutateAsync>[0]) => {
      await mutateAsync(value);
      await refreshAtomData(atomRegistry, authAtoms.me);
      await router.invalidate();
    },
    ...rest,
  };
};
