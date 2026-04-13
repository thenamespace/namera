/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: safe */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: safe */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: safe */
import { useHotkey } from "@tanstack/react-hotkeys";

import { cn } from "@namera-ai/ui/lib/utils";
import { Presence } from "@radix-ui/react-presence";

import { useAISearchContext } from "./context";
import { AISearchPanelHeader } from "./header";
import { AISearchInput } from "./input";
import { AISearchPanelList } from "./list";

export const AISearchPanel = () => {
  const { open, setOpen } = useAISearchContext();
  useHotkey("Meta+I", () => setOpen((prev) => !prev));

  return (
    <>
      <style>
        {`
        @keyframes ask-ai-open {
          from {
            translate: 100% 0;
          }
          to {
            translate: 0 0;
          }
        }
        @keyframes ask-ai-close {
          from {
            width: var(--ai-chat-width);
          }
          to {
            width: 0px;
          }
        }`}
      </style>
      <Presence present={open}>
        <div
          className="fixed inset-0 z-30 backdrop-blur-xs bg-fd-overlay data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out lg:hidden"
          data-state={open ? "open" : "closed"}
          onClick={() => setOpen(false)}
        />
      </Presence>
      <Presence present={open}>
        <div
          className={cn(
            "overflow-hidden z-30 bg-background text-foreground [--ai-chat-width:380px] 2xl:[--ai-chat-width:460px]",
            "max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:border max-lg:rounded-2xl max-lg:shadow-xl",
            "lg:sticky lg:top-0 lg:h-dvh lg:border-s lg:ms-auto lg:in-[#nd-docs-layout]:[grid-area:toc] lg:in-[#nd-notebook-layout]:row-span-full lg:in-[#nd-notebook-layout]:col-start-5",
            open
              ? "animate-fd-dialog-in lg:animate-[ask-ai-open_200ms]"
              : "animate-fd-dialog-out lg:animate-[ask-ai-close_200ms]",
          )}
        >
          <div className="flex flex-col size-full p-2 lg:p-3 lg:w-(--ai-chat-width)">
            <AISearchPanelHeader />
            <AISearchPanelList />
            <div className="rounded-xl bg-muted text-foreground shadow-sm has-focus-visible:shadow-md border">
              <AISearchInput />
            </div>
          </div>
        </div>
      </Presence>
    </>
  );
};
