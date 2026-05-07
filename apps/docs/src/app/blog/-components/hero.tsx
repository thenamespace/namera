import { useRef, useState } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@namera-ai/ui/components/ui/input-group";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import { cn } from "@namera-ai/ui/lib/utils";
import { MagnifyingGlassIcon, RssIcon } from "@phosphor-icons/react";
import { useDebounceCallback } from "usehooks-ts";

import type { BlogCategory } from "@/types";

const categories: {
  label: string;
  value?: BlogCategory;
}[] = [
  {
    label: "All",
    value: undefined,
  },
  {
    label: "Community",
    value: "community",
  },
  {
    label: "Case Studies",
    value: "case-study",
  },
  {
    label: "News",
    value: "news",
  },
  {
    label: "Changelog",
    value: "changelog",
  },
];

export const BlogHero = () => {
  const search = useSearch({ from: "/blog/" });
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [value, setValue] = useState(search.query ?? "");

  const updateQuery = useDebounceCallback((value: string) => {
    if (value === (search.query ?? "")) return;
    const trimmed = value.trim();
    if (trimmed === "" && !search.query) return;

    navigate({
      to: "/blog",
      search: (prev) => ({
        ...prev,
        query: trimmed,
        page: 1,
      }),
      replace: true,
    });
  }, 300);

  const updateCategory = useDebounceCallback((value?: BlogCategory) => {
    navigate({
      to: "/blog",
      search: (prev) => ({
        ...prev,
        category: value,
        page: 1,
      }),
      replace: true,
    });
  }, 300);

  useHotkey("/", () => {
    inputRef.current?.focus();
  });

  return (
    <div className="relative px-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl sm:text-4xl font-semibold">Blog</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-row items-center gap-3 text-sm">
            {categories.map((category) => {
              return (
                <button
                  className={cn(
                    "text-muted-foreground cursor-pointer hover:text-foreground transition-colors",
                    search.category === category.value && "text-foreground",
                  )}
                  key={category.value}
                  onClick={() => {
                    updateCategory(category.value);
                  }}
                  type="button"
                >
                  {category.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-row items-center gap-2 w-full sm:w-max">
            <InputGroup className="sm:max-w-sm w-full h-10 rounded-xl">
              <InputGroupInput
                onChange={(e) => {
                  const value = e.target.value;
                  setValue(value);
                  updateQuery(value);
                }}
                placeholder="Search blog..."
                ref={inputRef}
                value={value}
              />
              <InputGroupAddon className="pl-3 pr-1">
                <MagnifyingGlassIcon />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end" className="pr-4">
                <Kbd className="bg-accent rounded-md!">/</Kbd>
              </InputGroupAddon>
            </InputGroup>
            <Button
              className="text-muted-foreground"
              size="icon-lg"
              variant="ghost"
            >
              <RssIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
