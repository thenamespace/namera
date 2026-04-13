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
import { MagnifyingGlassIcon, RssIcon } from "@phosphor-icons/react";
import { useDebounceCallback } from "usehooks-ts";

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

  useHotkey("/", () => {
    inputRef.current?.focus();
  });

  return (
    <div className="relative">
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold">Blog</h1>
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-3 text-sm">
            <span className="cursor-pointer">All</span>
            <span className="text-muted-foreground cursor-pointer">
              Changelog
            </span>
            <span className="text-muted-foreground cursor-pointer">
              Community
            </span>
            <span className="text-muted-foreground cursor-pointer">News</span>
            <span className="text-muted-foreground cursor-pointer">
              Community
            </span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <InputGroup className="max-w-sm w-full h-10 rounded-full">
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
                <Kbd className="bg-accent">/</Kbd>
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
