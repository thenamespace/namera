import type { OrganizationId } from "@namera-ai/schema";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { switchOrganization } from "@/actions/auth/organization";
import { queries } from "@/lib/query";

export const useSwitchOrg = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: OrganizationId }) => {
      await switchOrganization(id);
    },
    onSuccess: async () => {
      await router.invalidate();
      await queryClient.invalidateQueries(queries.auth.me);
    },
  });
};
