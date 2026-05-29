// import type { UpdateUserRequest } from "@namera-ai/schema/dto";

// import { useMutation, useQueryClient } from "@tanstack/react-query";

// import { updateUser } from "@/actions-old";
// import { queries } from "@/lib/query";

// export const useUpdateUser = () => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: async (data: UpdateUserRequest) => updateUser(data),
//     onSuccess: async () => {
//       await queryClient.invalidateQueries(queries.auth.me);
//     },
//   });
// };

import { updateUserAtom } from "@/actions";
import { useAtomMutation } from "@/hooks/misc";

export const useUpdateUser = () => {
  return useAtomMutation(updateUserAtom);
};
