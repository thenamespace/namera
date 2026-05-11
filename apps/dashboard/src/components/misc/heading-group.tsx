import type { ComponentProps, ReactNode } from "react";

import { cn } from "@namera-ai/ui/lib/utils";

type HeadingGroupProps = ComponentProps<"div"> & {
  heading: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
};

export const HeadingGroup = ({
  heading,
  description,
  size = "md",
  className,
  ...props
}: HeadingGroupProps) => {
  const headingSize = () => {
    if (size === "lg") return "text-2xl";
    if (size === "md") return "text-xl";
    return "text-lg";
  };

  const descriptionSize = () => {
    if (size === "lg") return "text-sm";
    if (size === "md") return "text-sm";
    return "text-xs";
  };

  return (
    <div className={cn("flex flex-col gap-2 px-1 py-4", className)} {...props}>
      <div className={cn("font-medium", headingSize())}>{heading}</div>
      {description && (
        <p className={cn("text-muted-foreground", descriptionSize())}>
          {description}
        </p>
      )}
    </div>
  );
};
