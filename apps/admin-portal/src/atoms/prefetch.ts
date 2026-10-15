import { Effect } from "effect";
import { AtomRegistry, type AsyncResult, type Atom } from "effect/reactivity";

import type { PlatformPermission } from "@namera-ai/protocol/model";

import { currentAdminAtom } from "@/atoms/auth";
import { hasPermissions } from "@/lib/permissions";

export const prefetchQuery = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal,
) =>
  Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }), { signal });

export async function prefetchAuthorizedQuery<A, E>(
  registry: AtomRegistry.AtomRegistry,
  required: ReadonlyArray<PlatformPermission>,
  getAtom: () => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal,
) {
  const access = await prefetchQuery(registry, currentAdminAtom, signal);

  if (access.status === "authorized" && hasPermissions(access.admin.permissions, required)) {
    await prefetchQuery(registry, getAtom(), signal);
  }
}
