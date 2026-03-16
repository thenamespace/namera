import { useHotkeySequence } from "@tanstack/react-hotkeys";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@namera-ai/ui/components/ui/collapsible";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@namera-ai/ui/components/ui/sidebar";
import {
  FlaskIcon,
  KeyIcon,
  PulseIcon,
  TriangleIcon,
} from "@phosphor-icons/react/ssr";

const items = [
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
    href: "/dashboard/permissions",
    icon: FlaskIcon,
    title: "Permissions",
    tooltip: {
      hotKey: "P",
      text: "permissions",
    },
  },
  {
    href: "/dashboard/activity",
    icon: PulseIcon,
    title: "Activity",
    tooltip: {
      hotKey: "A",
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

  useHotkeySequence(["G", "P"], () => {
    navigate({
      to: "/dashboard/permissions",
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
            <SidebarGroupLabel className="h-5 select-none cursor-pointer flex flex-row gap-1.5 items-center" />
          }
        >
          Core Actions
          <TriangleIcon
            className="rotate-90 size-2! group-data-panel-open:rotate-180 transition-all"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex [&[hidden]:not([hidden='until-found'])]:hidden h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all ease-out data-ending-style:h-0 data-starting-style:h-0 duration-150">
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link to={item.href} />}
                  tooltip={{
                    children: (
                      <div className="flex flex-row gap-1 items-center">
                        <div>Go to {item.tooltip.text}</div>
                        <div>
                          <Kbd>G</Kbd> then <Kbd>{item.tooltip.hotKey}</Kbd>
                        </div>
                      </div>
                    ),
                  }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
