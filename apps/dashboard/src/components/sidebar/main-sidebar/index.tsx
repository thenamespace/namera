import type { PropsWithChildren } from "react";

import { SidebarLayout } from "../layout";
import { adminGroupItems } from "./admin";
import { coreGroupItems } from "./core";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";

const groups = [primaryGroupItems, coreGroupItems, adminGroupItems];
const header = <SidebarHeader />;

export const AppSidebar = ({ children }: PropsWithChildren) => (
  <SidebarLayout header={header} groups={groups}>
    {children}
  </SidebarLayout>
);
