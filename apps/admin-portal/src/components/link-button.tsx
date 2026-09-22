import { Link, type LinkComponentProps } from "@tanstack/react-router";

import { buttonVariants } from "@namera-ai/ui";
import { cn } from "@namera-ai/ui/utils";

/**
 * An anchor nested inside a `<Button>` is invalid markup and gives keyboard
 * users two focus stops for one action, so navigation is a styled anchor.
 */
export function LinkButton({
  className,
  variant = "primary",
  ...props
}: LinkComponentProps & { readonly variant?: "primary" | "secondary" | "tertiary" }) {
  return <Link {...props} className={cn(buttonVariants({ variant }), className)} />;
}
