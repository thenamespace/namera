import { Sidebar } from "@namera-ai/ui";

import { WorkspaceSwitcher } from "./workspace-switcher";

export const SidebarHeader = () => {
  return (
    <Sidebar.Header className="px-1!">
      <div className="flex items-center gap-3 px-1 py-2">
        <WorkspaceSwitcher />
      </div>
    </Sidebar.Header>
  );
};
