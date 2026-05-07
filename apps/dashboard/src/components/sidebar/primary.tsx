import { SidebarGroup, SidebarMenu } from "@namera-ai/ui/components/ui/sidebar";
import { WalletLottieIcon, OverviewLottieIcon } from "@namera-ai/ui/lottie";

import { SidebarButton } from "./sidebar-button";

const items = [
  {
    href: "/dashboard",
    lottie: OverviewLottieIcon,
    title: "Overview",
    tooltip: {
      text: "overview",
    },
  },
  {
    href: "/dashboard/assets",
    lottie: WalletLottieIcon,
    title: "Assets",
    tooltip: {
      text: "assets",
    },
  },
] as const;

export const PrimaryGroup = () => {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          return <SidebarButton key={item.title} {...item} />;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
};
