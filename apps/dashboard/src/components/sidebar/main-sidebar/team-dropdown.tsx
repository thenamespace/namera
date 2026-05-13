import { useMemo, useState } from "react";

import { CaretDownIcon } from "@phosphor-icons/react";

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
import { SidebarMenuButton } from "@namera-ai/ui/components/ui/sidebar";

const teams = [
  {
    name: "Envoy1084",
    avatar: "https://euc.li/envoy1084.eth",
  },
  {
    name: "Namera",
    avatar:
      "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKApivzcVtgFPIKXeNmJYMUTz0HpbiVLDoxQR7",
  },
];

export const TeamDropdownButton = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton className="w-fit px-1 group-data-[collapsible=icon]:p-1!" />
        }
      >
        <img
          src="https://euc.li/envoy1084.eth"
          alt=""
          className="size-6 rounded-xl"
        />
        <span>Envoy1084</span>
        <CaretDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem>
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
          <SwitchTeamButton />
          <DropdownMenuItem>Log out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SwitchTeamButton = () => {
  const [active, setActive] = useState("Envoy1084");

  const activeTeam = useMemo(() => {
    return teams.find((team) => team.name === active) || teams[0]!;
  }, [active]);
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Switch team</DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={activeTeam.name}
              onValueChange={(v) => setActive(v)}
            >
              {teams.map((team) => (
                <DropdownMenuRadioItem key={team.name} value={team.name}>
                  <img src={team.avatar} alt="" className="size-6 rounded-xl" />
                  <span className="text-[13px]">{team.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
