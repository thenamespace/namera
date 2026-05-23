import type { UpdateUserRequest } from "@namera-ai/schema";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateUser } from "@/actions";
import { queries } from "@/lib/query";

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateUserRequest) => updateUser(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries(queries.auth.me);
    },
  });
};
