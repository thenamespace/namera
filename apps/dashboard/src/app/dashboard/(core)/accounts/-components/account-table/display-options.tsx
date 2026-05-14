import { useState } from "react";

import { formatForDisplay } from "@tanstack/react-hotkeys";

import { SlidersHorizontalIcon } from "@phosphor-icons/react";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@namera-ai/ui/components/ui/dropdown-menu";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@namera-ai/ui/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@namera-ai/ui/components/ui/tooltip";
import { cn } from "@namera-ai/ui/lib/utils";

const groupingOptions = [
  { label: "No grouping", value: "none" },
  { label: "Owner", value: "owner" },
  { label: "Kernel Version", value: "kernel-version" },
  { label: "Entrypoint Version", value: "entrypoint-version" },
];

const orderingOptions = [
  { label: "Name", value: "name" },
  { label: "Owner", value: "owner" },
  { label: "Created", value: "created" },
  { label: "Last Used", value: "last-used" },
];

const displayOptions = [
  { label: "Name", value: "name" },
  { label: "Owner", value: "owner" },
  { label: "Kernel Version", value: "kernel-version" },
  { label: "Entrypoint Version", value: "entrypoint-version" },
  { label: "Created", value: "created" },
  { label: "Last Used", value: "last-used" },
];

export const AccountDisplayOptions = () => {
  const [selectedDisplayOptions, setSelectedDisplayOptions] = useState<
    string[]
  >(["name", "owner"]);

  const toggleDisplayOption = (option: string) => {
    if (selectedDisplayOptions.includes(option)) {
      setSelectedDisplayOptions(
        selectedDisplayOptions.filter((o) => o !== option),
      );
    } else {
      setSelectedDisplayOptions([...selectedDisplayOptions, option]);
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger>
          <DropdownMenuTrigger
            render={
              <Button variant="muted" size="icon-sm" className="rounded-full" />
            }
          >
            <SlidersHorizontalIcon className="size-3.5" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          Show display options <Kbd>{formatForDisplay("Shift+V")}</Kbd>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="min-w-xs px-3 py-2">
        <DropdownMenuGroup className="flex flex-col gap-1.5">
          {/* Grouping */}
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="text-muted-foreground text-xs">Grouping</div>
            <Select items={groupingOptions} defaultValue="none">
              <SelectTrigger className="" size="sm">
                <SelectValue className="text-xs!" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {groupingOptions.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="text-xs"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {/* Ordering */}
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="text-muted-foreground text-xs">Ordering</div>
            <Select items={orderingOptions} defaultValue="name">
              <SelectTrigger className="" size="sm">
                <SelectValue className="text-xs" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {orderingOptions.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="text-xs"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-0 pb-3!">
            Display Properties
          </DropdownMenuLabel>
          <div className="flex flex-row flex-wrap gap-1">
            {displayOptions.map((item) => {
              const selected = selectedDisplayOptions.includes(item.value);
              return (
                <button
                  type="button"
                  onClick={() => toggleDisplayOption(item.value)}
                  key={item.value}
                  className={cn(
                    "border-input bg-muted/50 text-muted-foreground hover:bg-accent selection:bg-accent cursor-pointer rounded-full border px-2 py-0.5 text-[11px]",
                    selected ? "bg-foreground/10 hover:bg-foreground/10" : "",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
