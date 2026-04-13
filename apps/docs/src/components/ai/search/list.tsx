/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: safe */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: safe */
import { type ComponentProps, useEffect, useRef } from "react";

import { cn } from "@namera-ai/ui/lib/utils";
import { ChatIcon } from "@phosphor-icons/react";

import { useAIChatContext } from "./context";
import { Message } from "./message";

const List = (props: Omit<ComponentProps<"div">, "dir">) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    function callback() {
      const container = containerRef.current;
      if (!container) return;

      container.scrollTo({
        behavior: "instant",
        top: container.scrollHeight,
      });
    }

    const observer = new ResizeObserver(callback);
    callback();

    const element = containerRef.current?.firstElementChild;

    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      {...props}
      className={cn(
        "fd-scroll-container overflow-y-auto min-w-0 flex flex-col",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
};

export const AISearchPanelList = () => {
  const chat = useAIChatContext();
  const messages = chat.messages.filter((msg) => msg.role !== "system");

  return (
    <List
      className="py-4 overscroll-contain flex-1"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent, white 1rem, white calc(100% - 1rem), transparent 100%)",
      }}
    >
      {messages.length === 0 ? (
        <div className="text-sm text-fd-muted-foreground/80 size-full flex flex-col items-center justify-center text-center gap-2">
          <ChatIcon className="size-5" />
          <p onClick={(e) => e.stopPropagation()}>Start a new chat below.</p>
        </div>
      ) : (
        <div className="flex flex-col px-3 gap-4">
          {chat.error && (
            <div className="p-2 bg-fd-secondary text-fd-secondary-foreground border rounded-lg">
              <p className="text-xs text-fd-muted-foreground mb-1">
                Request Failed: {chat.error.name}
              </p>
              <p className="text-sm">{chat.error.message}</p>
            </div>
          )}
          {messages.map((item) => (
            <Message key={item.id} message={item} />
          ))}
        </div>
      )}
    </List>
  );
};
