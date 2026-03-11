"use client";

import { useState } from "react";

import { buttonVariants } from "@namera-ai/ui/components/ui/button";
import { cn } from "@namera-ai/ui/lib/utils";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { ChevronDown } from "lucide-react";

const items = [
  {
    name: "All",
    value: undefined,
  },
  {
    description: "Only results about framework guides",
    name: "Framework",
    value: "framework",
  },
  {
    description: "Only results about Core",
    name: "Core",
    value: "core",
  },
  {
    description: "Only results about CLI",
    name: "CLI",
    value: "cli",
  },
  {
    description: "Only results about MCP",
    name: "MCP",
    value: "mcp",
  },
  {
    description: "Only results about x402",
    name: "x402",
    value: "x402",
  },
];

export const CustomSearchDialog = (props: SharedProps) => {
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState<string | undefined>();
  const { search, setSearch, query } = useDocsSearch({
    tag,
    type: "fetch",
  });

  return (
    <SearchDialog
      isLoading={query.isLoading}
      onSearchChange={setSearch}
      search={search}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== "empty" ? query.data : null} />
        <SearchDialogFooter className="flex flex-row flex-wrap gap-2 items-center">
          <Popover modal={false} onOpenChange={setOpen} open={open}>
            <PopoverTrigger
              className={buttonVariants({
                className: "-m-1.5 me-auto",
                size: "sm",
                variant: "ghost",
              })}
            >
              <span className="text-fd-muted-foreground/80 me-2">Filter</span>
              {items.find((item) => item.value === tag)?.name}
              <ChevronDown className="size-3.5 text-fd-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="flex flex-col p-1 gap-1">
              {items.map((item, i) => {
                const isSelected = item.value === tag;

                return (
                  <button
                    className={cn(
                      "rounded-lg text-start px-2 py-1.5",
                      isSelected
                        ? "text-fd-primary bg-fd-primary/10"
                        : "hover:text-fd-accent-foreground hover:bg-fd-accent",
                    )}
                    key={i.toString()}
                    onClick={(e) => {
                      e.preventDefault();
                      setTag(item.value);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    <p className="font-medium mb-0.5">{item.name}</p>
                    <p className="text-xs opacity-70">{item.description}</p>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
          <a
            className="text-xs text-nowrap text-fd-muted-foreground"
            href="https://orama.com"
            rel="noreferrer noopener"
          >
            Powered by Orama
          </a>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
};
