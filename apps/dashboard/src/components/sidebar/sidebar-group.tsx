// oxlint-disable react-perf/jsx-no-new-object-as-prop typescript/no-explicit-any
import type { ReactNode } from "react";

import { Link, useMatchRoute } from "@tanstack/react-router";

import { cn, Kbd, Sidebar } from "@namera-ai/ui";
import { HugeiconsIcon, type IconSvgElement } from "@namera-ai/ui/icons";

export type SidebarGroupItemsProps = {
  label: ReactNode;
  ariaLabel: string;
  items: {
    id: string;
    href?: string;
    textValue: string;
    icon: IconSvgElement;
    label: ReactNode;
    tooltip: {
      hotKey?: string;
      text: string;
    };
  }[];
};

export const SidebarGroup = ({ label, ariaLabel, items }: SidebarGroupItemsProps) => {
  const matchRoute = useMatchRoute();

  return (
    <Sidebar.Group>
      <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
      <Sidebar.Menu aria-label={ariaLabel}>
        {items.map((item) => {
          const isCurrent = item.href
            ? Boolean(
                matchRoute({
                  to: item.href,
                  fuzzy: true,
                  includeSearch: false,
                }),
              )
            : false;

          return (
            <Sidebar.MenuItem
              closeMobileOnAction={true}
              isCurrent={isCurrent}
              id={item.id}
              key={item.id}
              // oxlint-disable-next-line react-perf/jsx-no-new-function-as-prop
              render={({ children, ...props }) => {
                if (item.href) {
                  return (
                    <div {...props}>
                      <Link to={item.href as any} className="w-full">
                        {children}
                      </Link>
                    </div>
                  );
                }

                return <div {...props}>{children}</div>;
              }}
              textValue={item.textValue}
              tooltipProps={{
                placement: "right",
                content: (
                  <div className="flex flex-row gap-2 items-center">
                    <div>Go to {item.tooltip.text}</div>
                    {item.tooltip.hotKey && (
                      <div className="flex flex-row items-center gap-1">
                        <Kbd className="size-5 rounded-md flex items-center justify-center">
                          <Kbd.Content className="text-xs font-normal">G</Kbd.Content>
                        </Kbd>
                        then
                        <Kbd className="size-5 rounded-md flex items-center justify-center">
                          <Kbd.Content className="text-xs font-normal">
                            {item.tooltip.hotKey}
                          </Kbd.Content>
                        </Kbd>
                      </div>
                    )}
                  </div>
                ),
                className: "border py-1 rounded-lg min-h-8 flex items-center",
              }}
            >
              <Sidebar.MenuIcon>
                <HugeiconsIcon
                  icon={item.icon}
                  size={16}
                  className={cn(isCurrent ? "text-foreground" : "text-muted")}
                />
              </Sidebar.MenuIcon>
              <Sidebar.MenuLabel
                className={cn(isCurrent ? "text-foreground" : "text-muted", "font-normal")}
              >
                {item.label}
              </Sidebar.MenuLabel>
            </Sidebar.MenuItem>
          );
        })}
      </Sidebar.Menu>
    </Sidebar.Group>
  );
};
