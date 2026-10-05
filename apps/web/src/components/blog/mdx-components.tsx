import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@namera-ai/ui/utils";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import type { MDXComponents } from "mdx/types";

import { legalMdxComponents } from "../legal/mdx-components";
import { MermaidDiagram } from "./diagrams/mermaid-diagram";
import { SequenceDiagram } from "./diagrams/sequence-diagram";

export const blogMdxComponents = {
  ...legalMdxComponents,
  SequenceDiagram,
  MermaidDiagram,
  Mermaid: MermaidDiagram,
  ul: ({ className, ...props }) => (
    <ul
      className={cn("my-5 list-disc space-y-1 pl-6 text-base leading-7 text-muted", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("my-5 list-decimal space-y-1 pl-6 text-base leading-7 text-muted", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 [&>p]:my-1", className)} {...props} />,
  pre: ({ ref: _ref, children, className, ...props }) => {
    const code = Children.toArray(children).find(isValidElement);
    if (
      code &&
      isValidElement<{ className?: string; children?: ReactNode }>(code) &&
      code.props.className === "language-mermaid" &&
      typeof code.props.children === "string"
    ) {
      return <MermaidDiagram chart={code.props.children} />;
    }
    return (
      <CodeBlock
        {...props}
        className={cn(
          "blog-code my-8 border-border bg-surface text-foreground shadow-none",
          className,
        )}
        viewportProps={{ "aria-label": "Code example", className: "text-[15px]" }}
      >
        <Pre className="leading-6 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[inherit]">
          {children}
        </Pre>
      </CodeBlock>
    );
  },
  code: ({ children, className, ...props }) => (
    <code
      className={cn(
        "blog-inline-code rounded bg-surface px-1 py-0.5 text-[0.875em] text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-8 border-l-2 border-muted pl-6 text-lg italic text-foreground">
      {children}
    </blockquote>
  ),
  img: ({ alt, ...props }) => (
    <img alt={alt ?? ""} loading="lazy" className="my-8 h-auto max-w-full rounded-lg" {...props} />
  ),
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border p-3 font-medium text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border p-3 text-muted">{children}</td>,
} satisfies MDXComponents;
