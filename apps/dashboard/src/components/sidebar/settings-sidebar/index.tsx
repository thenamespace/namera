import type { PropsWithChildren } from "react";

import { SidebarLayout } from "../layout";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";
import { workspaceGroupItems } from "./workspace";

const groups = [primaryGroupItems, workspaceGroupItems];
const header = <SidebarHeader />;

export const SettingsSidebar = ({ children }: PropsWithChildren) => (
  <SidebarLayout header={header} groups={groups}>
    {children}
  </SidebarLayout>
);
