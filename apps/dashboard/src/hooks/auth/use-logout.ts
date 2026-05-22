import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { logout } from "@/actions";
import { queries } from "@/lib/query";

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: async () => {
      await queryClient.cancelQueries(queries.auth.me);
      queryClient.setQueryData(queries.auth.me.queryKey, null);
      await router.invalidate();
    },
  });
};
