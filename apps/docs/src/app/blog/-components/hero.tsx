import { useRef, useState } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@namera-ai/ui/components/ui/input-group";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useDebounceCallback } from "usehooks-ts";

export const BlogHero = () => {
  const search = useSearch({ from: "/blog/" });
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [value, setValue] = useState(search.query);

  const updateQuery = useDebounceCallback((value: string) => {
    if (value === search.query) return;
    const trimmed = value.trim();
    if (trimmed === "" && trimmed === search.query) return;
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
    <div className="relative pt-12">
      <div className="absolute top-2/7 translate-x-1/2 right-1/2 flex flex-col gap-6 items-center w-full px-4">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-helveticaDisplay heading-gradient pb-2">
          Blog
        </h1>
        <p className="font-normal text-accent-foreground text-base text-center sm:text-lg">
          Explore the latest updates and insights from the Namera team.
        </p>
        <InputGroup className="h-12 max-w-sm w-full">
          <InputGroupInput
            defaultValue={search.query}
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
            <Kbd className="bg-primary/15">/</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <img
        alt="Blog Hero"
        className="w-full h-[40dvh]"
        src="/assets/blog-bg.jpg"
      />
    </div>
  );
};
