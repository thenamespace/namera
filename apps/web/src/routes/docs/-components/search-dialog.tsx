import { useEffect, useState } from "react";

import { captureAnalytics } from "@namera-ai/telemetry/analytics/browser";
import { IconChevronDown } from "@namera-ai/ui/icons";
import { useDocsSearch } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
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
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";

const filters = [
  { name: "All", value: undefined, description: "Search all documentation" },
  { name: "Dashboard", value: "dashboard", description: "Introduction and Why Namera" },
  { name: "SDK", value: "sdk", description: "TypeScript SDK documentation" },
  { name: "CLI", value: "cli", description: "Command-line documentation" },
  { name: "MCP", value: "mcp", description: "Agent connection documentation" },
] as const;

export function DocsSearchDialog(props: SharedProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [tag, setTag] = useState<string>();
  const search = useDocsSearch({
    client: fetchClient({ api: "/api/docs/search", ...(tag ? { tag } : {}) }),
  });
  useEffect(() => {
    if (!search.data?.query || search.isLoading || search.error) return;
    captureAnalytics("docs_search_completed", {
      query_length: search.data.query.length,
      result_count: search.data.items.length,
      section: tag ?? "all",
    });
  }, [search.data, search.isLoading, search.error, tag]);

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent
        className="rounded-[0.75rem]"
        onClick={(event) => {
          const link = event.target instanceof Element ? event.target.closest("a") : null;
          if (link?.pathname.startsWith("/docs"))
            captureAnalytics("docs_search_result_clicked", { destination: link.pathname });
        }}
      >
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
        <SearchDialogFooter className="flex flex-wrap items-center gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              aria-label={`Filter documentation: ${filters.find((filter) => filter.value === tag)?.name}`}
              className={buttonVariants({
                size: "sm",
                variant: "ghost",
                className: "-m-1.5 me-auto gap-2",
              })}
            >
              <span className="text-fd-muted-foreground">Filter</span>
              {filters.find((filter) => filter.value === tag)?.name}
              <IconChevronDown className="size-3.5 text-fd-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="flex flex-col gap-1 p-1" align="start">
              {filters.map((filter) => (
                <button
                  key={filter.name}
                  type="button"
                  aria-pressed={filter.value === tag}
                  onClick={() => {
                    if (tag !== filter.value)
                      captureAnalytics("docs_search_filter_changed", {
                        section: filter.value ?? "all",
                      });
                    setTag(filter.value);
                    setFilterOpen(false);
                  }}
                  className="rounded-lg px-2 py-1.5 text-start hover:bg-fd-accent aria-pressed:bg-fd-secondary"
                >
                  <span className="mb-0.5 block font-medium">{filter.name}</span>
                  <span className="block text-xs text-fd-muted-foreground">
                    {filter.description}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
