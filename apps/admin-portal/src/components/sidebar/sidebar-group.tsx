import { useMatchRoute } from "@tanstack/react-router";

import { Sidebar } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import type { NavigationGroup } from "./navigation";

export function SidebarGroup({ group }: { readonly group: NavigationGroup }) {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar.Group>
      <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
      <Sidebar.Menu aria-label={`${group.label} navigation`}>
        {group.items.map((item) => {
          const isCurrent = Boolean(
            matchRoute({ to: item.href, fuzzy: item.href !== "/", includeSearch: false }),
          );

          return (
            <Sidebar.MenuItem
              key={item.href}
              id={item.href}
              href={item.href}
              textValue={item.label}
              isCurrent={isCurrent}
              closeMobileOnAction
              className="max-md:min-h-11"
              // oxlint-disable-next-line react-perf/jsx-no-new-object-as-prop
              tooltipProps={{
                placement: "right",
                content: `Go to ${item.label}`,
                className: "border py-1 rounded-lg min-h-8 flex items-center",
              }}
            >
              <Sidebar.MenuIcon>
                <HugeiconsIcon
                  icon={item.icon}
                  size={16}
                  className={isCurrent ? "text-foreground" : "text-muted"}
                />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel
                className={isCurrent ? "text-foreground font-normal" : "text-muted font-normal"}
              >
                {item.label}
              </Sidebar.MenuLabel>
            </Sidebar.MenuItem>
          );
        })}
      </Sidebar.Menu>
    </Sidebar.Group>
  );
}
