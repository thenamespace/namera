import { useState, type ComponentProps } from "react";

import { captureAnalytics } from "@namera-ai/telemetry/analytics/browser";
import { Button } from "@namera-ai/ui/button";
import { Copy01Icon, Icon } from "@namera-ai/ui/icons";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import defaultMdxComponents from "fumadocs-ui/mdx";

function CopyAction({ className }: { className?: string | undefined }) {
  const [status, setStatus] = useState("Copy code");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? ""}
      aria-label={status}
      onClick={async (event) => {
        const figure = event.currentTarget.closest("figure");
        const pre = figure?.querySelector("pre");
        if (!pre) return;
        const clone = pre.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));
        try {
          // Clipboard contents are never passed to analytics.
          await navigator.clipboard.writeText(clone.textContent ?? "");
          setStatus("Copied");
          captureAnalytics("docs_code_copied", {
            action: figure?.closest(".docs-response") ? "response" : "example",
          });
        } catch {
          setStatus("Copy failed. Try again");
        }
      }}
    >
      <Icon icon={Copy01Icon} aria-hidden className="size-3.5" />
      <span className="sr-only" aria-live="polite">
        {status}
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
  const [status, setStatus] = useState("Copy Markdown");
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={buttonVariants({
        variant: "secondary",
        className: "h-9 gap-2 px-3 text-sm [&_svg]:text-fd-muted-foreground",
      })}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const content = fetch(markdownUrl).then(async (response) => {
            if (!response.ok) throw new Error("Markdown unavailable");
            return response.text();
          });
          // Start the clipboard operation in the click gesture (Safari requires this).
          await navigator.clipboard.write([new ClipboardItem({ "text/plain": content })]);
          setStatus("Copied Markdown");
          captureAnalytics("docs_markdown_copied");
        } catch {
          setStatus("Copy failed. Try again");
        } finally {
          setPending(false);
        }
      }}
    >
      <Icon icon={Copy01Icon} aria-hidden className="size-3.5" />
      <span aria-live="polite">{status}</span>
    </button>
  );
}
