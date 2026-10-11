import type { ComponentProps } from "react";

import { BrandGithubIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { SITE_LINKS } from "#/lib/site-links";

export function DocsHeaderActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("flex items-center gap-3", className)}>
      {SITE_LINKS.github ? (
        <a
          href={SITE_LINKS.github}
          aria-label="Namera on GitHub"
          target="_blank"
          rel="noreferrer noopener"
          className="grid size-8 place-items-center rounded-md text-fd-muted-foreground hover:text-fd-foreground"
        >
          <BrandGithubIcon aria-hidden className="size-5" />
        </a>
      ) : null}
    </div>
  );
}
