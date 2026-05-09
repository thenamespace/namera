import { FingerprintIcon, NotificationIcon } from "@phosphor-icons/react";

import { SidebarGroup, SidebarMenu } from "@namera-ai/ui/components/ui/sidebar";
import { SettingsLottieIcon, UserLottieIcon } from "@namera-ai/ui/lottie";

import { SidebarButton } from "../sidebar-button";

const items = [
  {
    href: "/dashboard/settings/preferences",
    lottie: SettingsLottieIcon,
    title: "Preferences",
    tooltip: {
      text: "preferences",
    },
  },
  {
    href: "/dashboard/settings/profile",
    lottie: UserLottieIcon,
    title: "Profile",
    tooltip: {
      text: "profile",
    },
  },
  {
    href: "/dashboard/settings/notifications",
    icon: NotificationIcon,
    title: "Notifications",
    tooltip: {
      text: "notifications",
    },
  },
  {
    href: "/dashboard/settings/security",
    icon: FingerprintIcon,
    title: "Security",
    tooltip: {
      text: "security",
    },
  },
] as const;

export const CoreGroup = () => {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarButton key={item.title} {...item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
