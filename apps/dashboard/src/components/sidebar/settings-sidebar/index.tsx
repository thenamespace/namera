import { useCallback, useState, type PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

import { FeedbackDialog } from "@/components/feedback/dialog";
import { FeedbackSidebarFooter } from "@/components/feedback/sidebar-footer";
import { DashboardShellContext } from "@/components/page/route-state";

import { ResponsiveSidebar } from "../responsive-sidebar";
import { SidebarGroup } from "../sidebar-group";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";
import { workspaceGroupItems } from "./workspace";

export const SettingsSidebar = ({ children }: PropsWithChildren) => {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas">
      <ResponsiveSidebar>
        <SidebarHeader />
        <Sidebar.Content>
          <SidebarGroup {...primaryGroupItems} />
          <SidebarGroup {...workspaceGroupItems} />
        </Sidebar.Content>
        <FeedbackSidebarFooter onOpen={openFeedback} />
      </ResponsiveSidebar>
      <DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider>
      {feedbackOpen ? <FeedbackDialog onClose={closeFeedback} /> : null}
    </Sidebar.Provider>
  );
};
