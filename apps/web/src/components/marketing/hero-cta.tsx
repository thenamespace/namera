import { cn } from "@namera-ai/ui/utils";

import { ActionAnchor } from "#/components/marketing/primitives";
import { SITE_LINKS } from "#/lib/site-links";

export const HeroCta = ({ placement = "hero" }: { readonly placement?: "hero" | "closing" }) => (
  <div
    className={cn("flex flex-wrap items-center gap-3", placement === "closing" && "justify-center")}
  >
    {SITE_LINKS.app === null ? null : (
      <ActionAnchor
        href={SITE_LINKS.app}
        data-analytics-placement={placement}
        variant="light"
        className="h-11 px-5 text-[0.9375rem]"
      >
        Get started
      </ActionAnchor>
    )}
    <ActionAnchor
      href={SITE_LINKS.docs}
      data-analytics-placement={placement}
      variant="secondary"
      className="h-11 px-5 text-[0.9375rem]"
    >
      Docs
    </ActionAnchor>
  </div>
);
