import { useEffect, useRef, useState, type ReactNode } from "react";

import { useRouter } from "@tanstack/react-router";

import type { UserActorData } from "@namera-ai/protocol/dto";

import { sessionAuthority } from "@/atoms/auth/authority";
import { DataLoading } from "@/components/data-loading";
import { RouterError } from "@/components/route-failure";
import { useCurrentUser } from "@/hooks/auth/session";

export function SessionBoundary({
  actor,
  children,
}: {
  actor: UserActorData;
  children: ReactNode;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const observed = sessionAuthority(currentUser.data);
  const loaded = sessionAuthority(actor);
  const changed = observed !== undefined && observed !== loaded;
  const running = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!changed || running.current) return;
    running.current = true;
    setRefreshing(true);
    // Cancel old queries and erase their previous successes before reloading
    // route permissions. Normal data refreshes never reset the registry.
    router.options.context.atomRegistry.reset();
    void router
      .invalidate()
      .catch(() => setFailed(true))
      .finally(() => {
        running.current = false;
        setRefreshing(false);
      });
  }, [changed, router]);

  if (failed) return <RouterError />;
  if (changed || refreshing)
    return <DataLoading className="min-h-[50vh]" label="Refreshing workspace access" />;
  return children;
}
