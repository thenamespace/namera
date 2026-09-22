import { Link, type LinkComponentProps } from "@tanstack/react-router";

import { buttonVariants } from "@namera-ai/ui";
import { cn } from "@namera-ai/ui/utils";

/**
 * Navigation is an anchor, styled to match the design system's buttons. An
 * anchor nested inside a `<Button>` would be invalid markup and would give
 * keyboard users two focus stops for one action.
 */
export function LinkButton({
  className,
  variant = "primary",
  ...props
}: LinkComponentProps & { readonly variant?: "primary" | "secondary" | "tertiary" }) {
  return <Link {...props} className={cn(buttonVariants({ variant }), className)} />;
}
