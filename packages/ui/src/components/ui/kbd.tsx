import { cn } from "@namera-ai/ui/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-md bg-muted px-1 font-sans text-xs font-normal! text-muted-foreground select-none in-data-[slot=tooltip-content]:bg-popover dark:in-data-[slot=tooltip-content]:bg-popover [&_svg:not([class*='size-'])]:size-3 dark:in-data-[slot=tooltip-content]:text-popover-foreground in-data-[slot=tooltip-content]:text-popover-foreground in-data-[slot=tooltip-content]:border-border-light in-data-[slot=tooltip-content]:border-[0.5px]",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
