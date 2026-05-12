"use client";

import { type ElementType, useState } from "react";

import { formatForDisplay } from "@tanstack/react-hotkeys";

import { CaretUpDownIcon, PlusIcon } from "@phosphor-icons/react/ssr";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@namera-ai/ui/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@namera-ai/ui/components/ui/sidebar";
import { NameraIcon } from "@namera-ai/ui/icons";

type Account = {
  name: string;
  logo: ElementType;
};

const accounts: Account[] = [];

export function AccountSwitcher() {
  const { isMobile } = useSidebar();
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);

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
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
              {activeAccount ? (
                <activeAccount.logo className="size-5 fill-white" />
              ) : (
                <NameraIcon className="size-5 fill-white" />
              )}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {activeAccount ? activeAccount.name : "Namera"}
              </span>
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
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Accounts
              </DropdownMenuLabel>
              {accounts.map((account, index) => (
                <DropdownMenuItem
                  className="gap-2 p-2"
                  key={account.name}
                  onClick={() => setActiveAccount(account)}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <account.logo className="size-3.5 shrink-0 fill-white" />
                  </div>
                  {account.name}
                  <DropdownMenuShortcut>
                    {formatForDisplay(`Mod+${index + 1}`)}
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
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
