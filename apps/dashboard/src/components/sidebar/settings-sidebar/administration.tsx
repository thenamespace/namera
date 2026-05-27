import { UsersIcon } from "@phosphor-icons/react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@namera-ai/ui/components/ui/sidebar";
import { CardLottieIcon, WorkspaceLottieIcon } from "@namera-ai/ui/lottie";

import { SidebarButton } from "../sidebar-button";

const items = [
  {
    href: "/dashboard/settings/workspace",
    lottie: WorkspaceLottieIcon,
    title: "Workspace",
    tooltip: {
      text: "workspace",
    },
  },
  {
    href: "/dashboard/settings/notifications",
    icon: UsersIcon,
    title: "Members",
    tooltip: {
      text: "members",
    },
  },
  {
    href: "/dashboard/settings/security",
    lottie: CardLottieIcon,
    title: "Billing",
    tooltip: {
      text: "billing",
    },
  },
] as const;

export const AdministrationGroup = () => {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex h-10 flex-row items-center gap-1.5 select-none hover:bg-inherit">
        Administration
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarButton key={item.title} {...item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
