import { useMemo, useState } from "react";

import {
  CalendarIcon,
  FunnelIcon,
  ScrollIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@namera-ai/ui/components/ui/dropdown-menu";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";

const createdDateFilterOptions = [
  {
    label: "None",
    value: "none",
  },
  {
    label: "1 day ago",
    value: "1d",
  },
  {
    label: "3 days ago",
    value: "3d",
  },
  {
    label: "1 week ago",
    value: "1w",
  },
  {
    label: "1 month ago",
    value: "1m",
  },
  {
    label: "3 months ago",
    value: "3m",
  },
  {
    label: "6 months ago",
    value: "6m",
  },
  {
    label: "1 year ago",
    value: "1y",
  },
];

const CreatedAtFilter = () => {
  const [active, setActive] = useState("none");

  const activeCreatedFilter = useMemo(() => {
    return (
      createdDateFilterOptions.find((v) => v.value === active) ||
      createdDateFilterOptions[0]!
    );
  }, [active]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CalendarIcon />
        Created date
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={activeCreatedFilter.value}
              onValueChange={(v) => setActive(v)}
            >
              {createdDateFilterOptions.map((filter) => (
                <DropdownMenuRadioItem key={filter.value} value={filter.value}>
                  <span className="text-[13px]">{filter.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

const creatorFilterOptions = [
  {
    label: "Envoy1084",
    value: "envoy1084",
    avatar: "https://euc.li/envoy1084.eth",
  },
  {
    label: "Namera",
    value: "namera",
    avatar:
      "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKApivzcVtgFPIKXeNmJYMUTz0HpbiVLDoxQR7",
  },
];

const CreatorFilter = () => {
  const [active, setActive] = useState("none");

  const activeValue = useMemo(() => {
    return (
      creatorFilterOptions.find((v) => v.value === active) ||
      creatorFilterOptions[0]!
    );
  }, [active]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <UserCircleIcon />
        Creator
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={activeValue.value}
              onValueChange={(v) => setActive(v)}
            >
              {creatorFilterOptions.map((value) => (
                <DropdownMenuRadioItem key={value.value} value={value.value}>
                  <img
                    src={value.avatar}
                    alt=""
                    className="size-6 rounded-md"
                  />
                  <span className="text-[13px]">{value.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

const kernelVersionFilterOptions = [
  {
    label: "0.3.0",
    value: "0.3.0",
  },
  {
    label: "0.3.1",
    value: "0.3.1",
  },
  {
    label: "0.3.2",
    value: "0.3.2",
  },
  {
    label: "0.3.3",
    value: "0.3.3",
  },
];

const KernelVersionFilter = () => {
  const [active, setActive] = useState("0.3.0");

  const activeKernelVersion = useMemo(() => {
    return (
      kernelVersionFilterOptions.find((v) => v.value === active) ||
      kernelVersionFilterOptions[0]!
    );
  }, [active]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ScrollIcon />
        Kernel Version
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              value={activeKernelVersion.value}
              onValueChange={(v) => setActive(v)}
            >
              {kernelVersionFilterOptions.map((value) => (
                <DropdownMenuRadioItem key={value.value} value={value.value}>
                  <span className="text-[13px]">{value.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

export const AccountFilter = () => {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger>
          <DropdownMenuTrigger
            render={
              <Button variant="muted" size="icon-sm" className="rounded-full" />
            }
          >
            <FunnelIcon className="size-3.5" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          Add Filter <Kbd>F</Kbd>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add Filter</DropdownMenuLabel>
          <CreatedAtFilter />
          <CreatorFilter />
          <KernelVersionFilter />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
