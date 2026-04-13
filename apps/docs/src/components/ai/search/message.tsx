/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: safe */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: safe */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: safe */
import { Children, type ComponentProps, type ReactElement } from "react";

import { cn } from "@namera-ai/ui/lib/utils";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Tool, UIToolInvocation } from "ai";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Streamdown } from "streamdown";

import type { ChatUIMessage, SearchTool } from "@/app/api/chat";
import { getMDXComponents } from "@/components/mdx-components";

function Pre(props: ComponentProps<"pre">) {
  const code = Children.only(props.children) as ReactElement;
  const codeProps = code.props as ComponentProps<"code">;
  const content = codeProps.children;
  if (typeof content !== "string") return null;

  let lang =
    codeProps.className
      ?.split(" ")
      .find((v) => v.startsWith("language-"))
      ?.slice("language-".length) ?? "text";

  if (lang === "mdx") lang = "md";

  return (
    <DynamicCodeBlock
      code={content.trimEnd()}
      codeblock={{
        className: "shadow-none text-sm font-geist-mono",
      }}
      lang={lang}
    />
  );
}

const Markdown = ({ text }: { text: string }) => {
  return (
    <Streamdown
      // @ts-expect-error safe to ignore
      components={{
        ...getMDXComponents(),
        pre: Pre,
      }}
    >
      {text}
    </Streamdown>
  );
};

const roleName: Record<string, string> = {
  assistant: "Namera AI",
  user: "You",
};

export const Message = ({
  message,
  ...props
}: { message: ChatUIMessage } & ComponentProps<"div">) => {
  let markdown = "";
  const searchCalls: UIToolInvocation<SearchTool>[] = [];

  for (const part of message.parts ?? []) {
    if (part.type === "text") {
      markdown += part.text;
      continue;
    }

    if (part.type.startsWith("tool-")) {
      const toolName = part.type.slice("tool-".length);
      const p = part as UIToolInvocation<Tool>;

      if (toolName !== "search" || !p.toolCallId) continue;
      searchCalls.push(p);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} {...props}>
      <p
        className={cn(
          "mb-1 text-sm font-medium text-muted-foreground",
          message.role === "assistant" && "text-primary",
        )}
      >
        {roleName[message.role] ?? "Unknown"}
      </p>
      <div className="prose text-sm">
        <Markdown text={markdown} />
      </div>
      {searchCalls.map((call) => {
        return (
          <div
            className="flex flex-row gap-2 items-center mt-3 rounded-lg border bg-fd-secondary text-fd-muted-foreground text-xs p-2"
            key={call.toolCallId}
          >
            <MagnifyingGlassIcon className="size-4" />
            {call.state === "output-error" || call.state === "output-denied" ? (
              <p className="text-fd-error">
                {call.errorText ?? "Failed to search"}
              </p>
            ) : (
              <p>
                {!call.output
                  ? "Searching…"
                  : `${call.output.length} search results`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
