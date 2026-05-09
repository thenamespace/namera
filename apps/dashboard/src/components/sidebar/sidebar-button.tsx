import type { Icon } from "@phosphor-icons/react";

import { useRef } from "react";

import { Link } from "@tanstack/react-router";

import { Player } from "@lordicon/react";

import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@namera-ai/ui/components/ui/sidebar";

type SidebarButtonProps = {
  href: string;
  icon?: Icon;
  lottie?: any;
  title: string;
  tooltip: {
    text: string;
    hotkey?: string;
  };
};

export const SidebarButton = (item: SidebarButtonProps) => {
  const playerRef = useRef<Player>(null);

  const handleHover = () => {
    playerRef.current?.playFromBeginning();
  };

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        onMouseEnter={handleHover}
        render={
          <Link
            to={item.href}
            activeOptions={{
              exact: true,
              includeSearch: false,
            }}
            activeProps={{
              className:
                "bg-sidebar-accent text-foreground [--lord-icon-colorize:var(--foreground)]!",
            }}
          />
        }
        tooltip={{
          children: (
            <div className="flex flex-row items-center gap-1">
              <div>Go to {item.tooltip.text}</div>
              {item.tooltip?.hotkey && (
                <div>
                  <Kbd>G</Kbd> then <Kbd>{item.tooltip.hotkey}</Kbd>
                </div>
              )}
            </div>
          ),
        }}
      >
        {item.icon && <item.icon />}
        {item.lottie && (
          <div className="min-h-4 min-w-4">
            <Player
              icon={item.lottie}
              size={16}
              colorize="#000"
              ref={playerRef}
            />
          </div>
        )}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
