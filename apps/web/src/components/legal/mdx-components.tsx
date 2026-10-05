import { cn } from "@namera-ai/ui/utils";
import type { MDXComponents } from "mdx/types";

export const legalMdxComponents = {
  h2: ({ className, children, ...props }) => (
    <h2
      className={cn(
        "mt-14 mb-5 scroll-mt-24 text-2xl font-medium tracking-tight text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }) => (
    <h3
      className={cn("mt-8 mb-3 scroll-mt-24 text-lg font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-5 text-base leading-7 text-muted", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "my-5 list-disc space-y-3 pl-6 text-base leading-7 text-muted marker:text-ink-subtle",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "my-5 list-decimal space-y-3 pl-6 text-base leading-7 text-muted marker:text-foreground",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1 [&>p]:my-2", className)} {...props} />,
  a: ({ className, children, ...props }) => (
    <a
      className={cn(
        "rounded-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-medium text-foreground", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-10 border-border", className)} {...props} />
  ),
} satisfies MDXComponents;
