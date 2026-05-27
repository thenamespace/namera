import { Link } from "@tanstack/react-router";

import { CaretDownIcon, PlusIcon } from "@phosphor-icons/react";

import { useCurrentUser, useLogout } from "@/hooks/auth";
import { useListUserOrgs, useSwitchOrg } from "@/hooks/organization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@namera-ai/ui/components/ui/dropdown-menu";
import { MetadataIconRenderer } from "@namera-ai/ui/components/ui/icon-picker";
import { SidebarMenuButton } from "@namera-ai/ui/components/ui/sidebar";

export const WorkspaceDropdownButton = () => {
  const { data: currentUser } = useCurrentUser();
  const { mutateAsync: logout } = useLogout();

  if (!currentUser?.organization) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton className="w-fit px-1.5 py-4 group-data-[collapsible=icon]:p-1!" />
        }
      >
        <MetadataIconRenderer
          value={currentUser.organization.metadata.logo}
          className="h-6 w-6 rounded-xl"
          iconCls="size-5.5! rounded-xl"
          imageCls="min-w-6"
        />
        <span>{currentUser.organization.name}</span>
        <CaretDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={<Link to="/dashboard/settings">Settings</Link>}
          >
            <div className="flex w-full flex-row items-center justify-between">
              <span>Settings</span>
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">G</span> then{" "}
                <span className="font-medium">S</span>
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem>Invite & Manage Members</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <SwitchWorkspaceButton />
          <DropdownMenuItem
            onClick={async () => await logout()}
            variant="destructive"
          >
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SwitchWorkspaceButton = () => {
  const { data: currentUser } = useCurrentUser();
  const { data: userOrgs } = useListUserOrgs();
  const { mutateAsync: switchOrg, isPending } = useSwitchOrg();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Switch workspace</DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-48">
          <DropdownMenuItem render={<Link to="/workspace/new" />}>
            <PlusIcon />
            <span>Create workspace</span>
          </DropdownMenuItem>
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={currentUser?.organization?.id}
              disabled={isPending}
              onValueChange={async (v) => {
                await switchOrg({ id: v });
              }}
            >
              {userOrgs.map((org) => (
                <DropdownMenuRadioItem
                  key={org.organizationId}
                  value={org.organizationId}
                >
                  <MetadataIconRenderer
                    value={org.organization.metadata.logo}
                    className="h-6 w-6 rounded-xl"
                    iconCls="size-5.5! rounded-xl"
                    imageCls="min-w-6"
                  />
                  <span className="text-[13px]">{org.organization.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
