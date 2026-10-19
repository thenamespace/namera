import { useMemo, type PropsWithChildren } from "react";

import { CheckmarkCircle02Icon, CircleIcon } from "@namera-ai/ui/icons";

import { useGettingStarted } from "@/hooks/getting-started";

import { SidebarLayout } from "../layout";
import type { SidebarGroupItemsProps } from "../sidebar-group";
import { adminGroupItems } from "./admin";
import { coreGroupItems } from "./core";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";

const header = <SidebarHeader />;

export function AppSidebar({ children }: PropsWithChildren) {
  const { available, dismissed, isLoading, count } = useGettingStarted();
  const groups = useMemo(() => {
    const primary: SidebarGroupItemsProps = {
      ...primaryGroupItems,
      items:
        available && !dismissed
          ? [
              {
                id: "get-started",
                icon: count === 4 ? CheckmarkCircle02Icon : CircleIcon,
                label: (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>Get started</span>
                    <span
                      className="rounded-full bg-default px-1.5 text-[10px] tabular-nums text-muted"
                      aria-label={isLoading ? "Checking progress" : `${count} of 4 complete`}
                    >
                      {isLoading ? "…" : `${count}/4`}
                    </span>
                  </span>
                ),
                textValue: "Get started",
                href: "/get-started",
                tooltip: { text: "get started" },
              },
              ...primaryGroupItems.items,
            ]
          : primaryGroupItems.items,
    };

    return [primary, coreGroupItems, adminGroupItems];
  }, [available, dismissed, isLoading, count]);
  return (
    <SidebarLayout header={header} groups={groups}>
      {children}
    </SidebarLayout>
  );
}
