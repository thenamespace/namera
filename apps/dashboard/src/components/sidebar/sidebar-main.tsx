import type { PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

export const SidebarMain = ({ children }: PropsWithChildren) => {
  return (
    <Sidebar.Main className="bg-[#121213]">
      <div className="flex items-center gap-3 p-4">
        <Sidebar.Trigger />
      </div>
      {children}
    </Sidebar.Main>
  );
};
