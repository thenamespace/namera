import { signInWithMagicLink } from "@/actions";

import { useAtomMutation } from "../misc";

export const useSignInWithMagicLink = () => {
  return useAtomMutation(signInWithMagicLink);
};
