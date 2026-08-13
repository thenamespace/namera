import type { ComponentProps } from "react";

import { cn, inputVariants, type InputVariants } from "@namera-ai/ui";

type ReadOnlyInputProps = ComponentProps<"div"> & InputVariants;

export function ReadOnlyInput({
  className,
  fullWidth = true,
  variant = "secondary",
  ...props
}: ReadOnlyInputProps) {
  return (
    <div
      className={cn(inputVariants({ fullWidth, variant }), "flex items-center", className)}
      data-slot="input"
      {...props}
    />
  );
}

export type { ReadOnlyInputProps };
