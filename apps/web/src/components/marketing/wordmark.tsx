import { Link } from "@tanstack/react-router";

import { NameraIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

export const Wordmark = ({ className }: { readonly className?: string }) => (
  <Link
    to="/"
    aria-label="Namera home"
    className={cn(
      "tap-target -my-3 inline-flex items-center gap-2.5 rounded-md py-3 text-foreground",
      "transition-opacity duration-150 ease-out-quad hover:opacity-80",
      "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus/60",
      className,
    )}
  >
    {/* The mark ships with `fill="none"`; the spread override paints it. */}
    <NameraIcon aria-hidden fill="currentColor" className="h-[15px] w-auto" />
    <span className="text-[0.9375rem] leading-none font-semibold tracking-[-0.02em]">Namera</span>
  </Link>
);
