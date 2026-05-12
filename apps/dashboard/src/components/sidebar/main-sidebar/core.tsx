import { useHotkeySequence } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";

import { KeyIcon, TriangleIcon } from "@phosphor-icons/react/ssr";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@namera-ai/ui/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@namera-ai/ui/components/ui/sidebar";
import {
  AnalyticsLottieIcon,
  CategoryLottieIcon,
  UserLottieIcon,
} from "@namera-ai/ui/lottie";

import { SidebarButton } from "../sidebar-button";

const items = [
  {
    href: "/dashboard/accounts",
    lottie: UserLottieIcon,
    title: "Accounts",
    tooltip: {
      hotKey: "A",
      text: "accounts",
    },
  },
  {
    href: "/dashboard/session-keys",
    icon: KeyIcon,
    title: "Session Keys",
    tooltip: {
      hotKey: "S",
      text: "session keys",
    },
  },
  {
    href: "/dashboard/templates",
    lottie: CategoryLottieIcon,
    title: "Templates",
    tooltip: {
      hotKey: "T",
      text: "templates",
    },
  },
  {
    href: "/dashboard/activity",
    lottie: AnalyticsLottieIcon,
    title: "Activity",
    tooltip: {
      text: "activity",
    },
  },
] as const;

export const CoreGroup = () => {
  const navigate = useNavigate();

  useHotkeySequence(["G", "S"], () => {
    navigate({
      to: "/dashboard/session-keys",
    });
  });

  useHotkeySequence(["G", "T"], () => {
    navigate({
      to: "/dashboard/templates",
    });
  });

  useHotkeySequence(["G", "A"], () => {
    navigate({
      to: "/dashboard/activity",
    });
  });

  return (
    <SidebarGroup>
      <Collapsible className="flex w-full flex-col gap-1" defaultOpen={true}>
        <CollapsibleTrigger
          className="group"
          nativeButton={false}
          render={
            <SidebarGroupLabel className="flex h-6 cursor-pointer flex-row items-center gap-1.5 select-none" />
          }
        >
          Core Actions
          <TriangleIcon
            className="size-2! rotate-90 transition-all group-data-panel-open:rotate-180"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <SidebarMenu>
            {items.map((item) => (
              <SidebarButton key={item.title} {...item} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
