import type { ComponentProps, ReactNode } from "react";

import { Typography, cn } from "@namera-ai/ui";

export type HeadingGroupProps = ComponentProps<"div"> & {
  heading: ReactNode;
  description?: ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: "sm" | "md" | "lg";
};

const headingSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

const descriptionSizes = {
  sm: "xs",
  md: "sm",
  lg: "sm",
} as const;

export function HeadingGroup({
  className,
  description,
  heading,
  level = 2,
  size = "md",
  ...props
}: HeadingGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <Typography.Heading className={headingSizes[size]} level={level} weight="semibold">
        {heading}
      </Typography.Heading>
      {description !== undefined && description !== null ? (
        <Typography.Paragraph color="muted" size={descriptionSizes[size]}>
          {description}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}
