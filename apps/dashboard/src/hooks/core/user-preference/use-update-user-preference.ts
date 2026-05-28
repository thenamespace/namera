import type { UpdateUserPreferencesRequest } from "@namera-ai/schema/dto";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateUserPreferences } from "@/actions";
import { queries } from "@/lib/query";

export const useUpdateUserPreference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateUserPreferencesRequest) =>
      updateUserPreferences(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(queries.userPreference.get);
    },
  });
};
