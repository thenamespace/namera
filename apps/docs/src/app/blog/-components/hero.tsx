import { useRef } from "react";

import { useHotkey } from "@tanstack/react-hotkeys";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@namera-ai/ui/components/ui/input-group";
import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

export const BlogHero = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkey("/", (e) => {
    console.log(e);
    inputRef.current?.focus();
  });

  return (
    <div className="relative pt-12">
      <div className="absolute top-2/7 translate-x-1/2 right-1/2 flex flex-col gap-6 items-center w-full px-4">
        <h1 className="text-7xl font-helveticaDisplay heading-gradient pb-2">
          Blog
        </h1>
        <p className="font-normal text-accent-foreground text-lg">
          Explore the latest updates and insights from the Namera team.
        </p>
        <InputGroup className="h-12 max-w-sm w-full">
          <InputGroupInput placeholder="Search blog..." ref={inputRef} />
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
