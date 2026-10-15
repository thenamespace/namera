import { useCallback, useState, type PropsWithChildren, type ReactNode } from "react";

import { Sidebar } from "@namera-ai/ui";

import { FeedbackDialog } from "@/components/feedback/dialog";
import { FeedbackSidebarFooter } from "@/components/feedback/sidebar-footer";
import { DashboardShellContext } from "@/components/page/route-state";

import { ResponsiveSidebar } from "./responsive-sidebar";
import { SidebarGroup, type SidebarGroupItemsProps } from "./sidebar-group";

export function SidebarLayout({
  children,
  header,
  groups,
}: PropsWithChildren<{
  header: ReactNode;
  groups: readonly SidebarGroupItemsProps[];
}>) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas">
      <ResponsiveSidebar>
        {header}
        <Sidebar.Content>
          {groups.map((group) => (
            <SidebarGroup key={group.ariaLabel} {...group} />
          ))}
        </Sidebar.Content>
        <FeedbackSidebarFooter onOpen={openFeedback} />
      </ResponsiveSidebar>
      <DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider>
      {feedbackOpen ? <FeedbackDialog onClose={closeFeedback} /> : null}
    </Sidebar.Provider>
  );
}
