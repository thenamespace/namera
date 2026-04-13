/** biome-ignore-all lint/a11y/noAutofocus: safe */
import {
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@namera-ai/ui/components/ui/button";
import { PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";

import { useAISearchContext } from "./context";

export const AISearchInput = () => {
  const ref = useRef<HTMLDivElement>(null);
  const {
    chat: { status, stop, sendMessage },
  } = useAISearchContext();

  const [value, setValue] = useState("");

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const onSendMessage = (e?: SyntheticEvent) => {
    e?.preventDefault();
    const message = value.trim();
    if (message.length === 0) return;

    void sendMessage({
      parts: [
        {
          data: {
            location: location.href,
          },
          type: "data-client",
        },
        {
          text: message,
          type: "text",
        },
      ],
      role: "user",
    });
    setValue("");
  };

  useEffect(() => {
    if (isLoading) document.getElementById("ai-input")?.focus();
  }, [isLoading]);

  return (
    <form className="flex items-start pe-2" onSubmit={onSendMessage}>
      <div className="grid flex-1">
        <textarea
          autoFocus={true}
          className="resize-none bg-transparent placeholder:text-muted-foreground focus-visible:outline-none col-start-1 row-start-1 p-3 placeholder:text-sm text-sm"
          id="ai-input"
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={(event) => {
            if (!event.shiftKey && event.key === "Enter") {
              onSendMessage(event);
            }
          }}
          placeholder="Ask Namera AI..."
          rows={4}
          value={value}
        />
        <div className="break-all invisible col-start-1 row-start-1" ref={ref}>
          {`${value?.toString() ?? ""}\n`}
        </div>
      </div>
      <div className="mt-2">
        {isLoading ? (
          <Button onClick={stop} size="icon" type="button" variant="secondary">
            <StopIcon className="size-4  text-fd-muted-foreground" />
          </Button>
        ) : (
          <Button disabled={value.length === 0} size="icon" type="submit">
            <PaperPlaneTiltIcon className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
};
