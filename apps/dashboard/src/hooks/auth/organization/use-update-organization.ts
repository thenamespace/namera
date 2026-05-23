import type { UpdateOrganizationRequest } from "@namera-ai/schema";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateOrganization } from "@/actions/auth";
import { queries } from "@/lib/query";

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateOrganizationRequest) =>
      updateOrganization(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(queries.auth.me);
    },
  });
};
