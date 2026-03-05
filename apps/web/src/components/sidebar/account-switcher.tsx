"use client";

import * as react from "react";

import { formatForDisplay } from "@tanstack/react-hotkeys";

import {
  CaretUpDownIcon,
  FinnTheHumanIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/ui/sidebar";

const accounts: {
  name: string;
  logo: react.ElementType;
}[] = [
  {
    logo: FinnTheHumanIcon,
    name: "EnvoyOS",
  },
];

export function AccountSwitcher() {
  const { isMobile } = useSidebar();
  const [activeAccount, setActiveAccount] = react.useState(accounts[0]);

  if (!activeAccount) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground [&_svg]:size-5"
                size="lg"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <activeAccount.logo className="size-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{activeAccount.name}</span>
            </div>
            <CaretUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Accounts
              </DropdownMenuLabel>
              {accounts.map((account, index) => (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  key={account.name}
                  onClick={() => setActiveAccount(account)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border-border-light border">
                    <account.logo className="size-3.5 shrink-0" />
                  </div>
                  {account.name}
                  <DropdownMenuShortcut>
                    {formatForDisplay(`Mod+${index + 1}`)}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent border-border-light">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Create account
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
