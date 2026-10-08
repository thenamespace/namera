import type { PropsWithChildren } from "react";
import { useCallback } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { Sidebar } from "@namera-ai/ui";
import { NameraIcon } from "@namera-ai/ui/icons";

import { navigationGroups } from "./navigation";
import { SidebarGroup } from "./sidebar-group";

export function AdminSidebar({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const navigateTo = useCallback((href: string) => void navigate({ to: href }), [navigate]);

  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas" navigate={navigateTo}>
      <Sidebar>
        <Sidebar.Header className="px-1!">
          <Link
            to="/"
            aria-label="Namera Admin home"
            className="focus-visible:ring-focus flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2"
          >
            <NameraIcon aria-hidden="true" className="fill-foreground h-[1cap] w-auto shrink-0" />
            Namera <span className="text-muted font-normal">Admin</span>
          </Link>
        </Sidebar.Header>
        <Sidebar.Content>
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label} group={group} />
          ))}
        </Sidebar.Content>
      </Sidebar>
      {children}
    </Sidebar.Provider>
  );
}
