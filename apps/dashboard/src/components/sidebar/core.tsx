import { useHotkeySequence } from "@tanstack/react-hotkeys";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  AddressBookIcon,
  FlaskIcon,
  KeyIcon,
  PulseIcon,
  TriangleIcon,
} from "@phosphor-icons/react/ssr";

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

const items = [
  {
    href: "/dashboard/accounts",
    icon: AddressBookIcon,
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
            <SidebarGroupLabel className="flex h-5 cursor-pointer flex-row items-center gap-1.5 select-none" />
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
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={
                    <Link
                      to={item.href}
                      activeOptions={{
                        exact: false,
                      }}
                      activeProps={{
                        className: "bg-sidebar-accent",
                      }}
                    />
                  }
                  tooltip={{
                    children: (
                      <div className="flex flex-row items-center gap-1">
                        <div>Go to {item.tooltip.text}</div>
                        {"hotKey" in item.tooltip && (
                          <div>
                            <Kbd>G</Kbd> then <Kbd>{item.tooltip.hotKey}</Kbd>
                          </div>
                        )}
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
