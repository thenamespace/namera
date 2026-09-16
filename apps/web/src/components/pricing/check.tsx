import { Icon, Tick02Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

/**
 * A filled circle with a tick cut out of it. The free icon set only ships
 * outlines, and an outline at this size reads as a smudge next to text, so the
 * circle is drawn here and the tick sits inside it.
 */
export const Check = ({ className }: { readonly className?: string }) => (
  <span
    aria-hidden
    className={cn(
      "grid size-[1.0625rem] shrink-0 place-items-center rounded-full bg-foreground",
      className,
    )}
  >
    <Icon icon={Tick02Icon} strokeWidth={3.2} className="size-[0.625rem] text-background" />
  </span>
);
