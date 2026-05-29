import type { AtomRegistry } from "effect/unstable/reactivity";

import { redirect } from "@tanstack/react-router";

import { authAtoms } from "@/lib/atom";
import { ensureAtomData } from "@/lib/atom/loader";

export const authMiddleware = async (
  atomRegistry: AtomRegistry.AtomRegistry,
) => {
  const currentUser = await ensureAtomData(atomRegistry, authAtoms.me);

  if (!currentUser) {
    throw redirect({ to: "/auth" });
  }

  if (!currentUser.organization) {
    throw redirect({ to: "/workspace/new" });
  }

  return currentUser;
};
