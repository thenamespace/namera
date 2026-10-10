import { createContext, useContext, type PropsWithChildren } from "react";

import { PagePanelContext } from "./context";
import { DashboardPage } from "./index";

// Route fallbacks replace the page component, not the surrounding sidebar.
export const DashboardShellContext = createContext(false);

export function RouteState({ children }: PropsWithChildren) {
  const insideDashboard = useContext(DashboardShellContext);
  const insidePanel = useContext(PagePanelContext);
  if (!insideDashboard) return children;
  if (insidePanel) return <div className="grid min-h-[50vh] place-items-center">{children}</div>;
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <div className="grid min-h-[70vh] flex-1 place-items-center">{children}</div>
    </DashboardPage>
  );
}
