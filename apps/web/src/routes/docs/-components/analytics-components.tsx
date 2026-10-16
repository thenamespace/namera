import { useEffect, useRef, useState, type ComponentProps } from "react";

import { captureAnalytics } from "@namera-ai/telemetry/analytics/browser";
import { Button } from "@namera-ai/ui/button";
import { Cancel01Icon, Copy01Icon, Icon, Tick02Icon } from "@namera-ai/ui/icons";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import defaultMdxComponents from "fumadocs-ui/mdx";

type CopyState = "idle" | "copied" | "failed";

/** Shows the result of a copy for a moment, then returns to idle. */
function useCopyState() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (next: Exclude<CopyState, "idle">) => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  return [state, show] as const;
}

function CopyAction({ className }: { className?: string | undefined }) {
  const [state, show] = useCopyState();
  const label = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy code";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? ""}
      data-copy-state={state}
      aria-label={label}
      onClick={async (event) => {
        const figure = event.currentTarget.closest("figure");
        const pre = figure?.querySelector("pre");
        if (!pre) return;
        const clone = pre.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));
        try {
          // Clipboard contents are never passed to analytics.
          await navigator.clipboard.writeText(clone.textContent ?? "");
          show("copied");
          captureAnalytics("docs_code_copied", {
            action: figure?.closest(".docs-response") ? "response" : "example",
          });
        } catch {
          show("failed");
        }
      }}
    >
      <Icon
        icon={state === "copied" ? Tick02Icon : state === "failed" ? Cancel01Icon : Copy01Icon}
        aria-hidden
        className="size-3.5"
      />
      {state === "idle" ? null : (
        <span aria-hidden className="text-xs font-medium">
          {label}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {state === "idle" ? "" : label}
      </span>
    </Button>
  );
}

function TrackedCodeBlock(props: ComponentProps<typeof CodeBlock>) {
  return (
    <CodeBlock
      {...props}
      Actions={props.allowCopy === false || props.allowCopy === "false" ? () => null : CopyAction}
    >
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}

export const docsMdxComponents = { ...defaultMdxComponents, pre: TrackedCodeBlock };

export function DocsMarkdownCopy({ markdownUrl }: { markdownUrl: string }) {
  const [state, show] = useCopyState();
  const [pending, setPending] = useState(false);
  const label =
    state === "copied"
      ? "Copied Markdown"
      : state === "failed"
        ? "Copy failed. Try again"
        : "Copy Markdown";
  return (
    <button
      type="button"
      className={buttonVariants({
        variant: "secondary",
        className: "h-9 gap-2 px-3 text-sm [&_svg]:text-fd-muted-foreground",
      })}
      disabled={pending}
      data-copy-state={state}
      onClick={async () => {
        setPending(true);
        try {
          const content = fetch(markdownUrl).then(async (response) => {
            if (!response.ok) throw new Error("Markdown unavailable");
            return response.text();
          });
          // Start the clipboard operation in the click gesture (Safari requires this).
          await navigator.clipboard.write([new ClipboardItem({ "text/plain": content })]);
          show("copied");
          captureAnalytics("docs_markdown_copied");
        } catch {
          show("failed");
        } finally {
          setPending(false);
        }
      }}
    >
      <Icon
        icon={state === "copied" ? Tick02Icon : state === "failed" ? Cancel01Icon : Copy01Icon}
        aria-hidden
        className="size-3.5"
      />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
