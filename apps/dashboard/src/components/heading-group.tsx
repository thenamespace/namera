import type { ComponentProps } from "react";

import { Typography, cn } from "@namera-ai/ui";

type HeadingGroupSize = "sm" | "md" | "lg";

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

const HeadingGroupRoot = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);

type HeadingGroupTitleProps = ComponentProps<typeof Typography.Heading> & {
  size?: HeadingGroupSize;
};

const HeadingGroupTitle = ({
  className,
  level = 2,
  size = "md",
  ...props
}: HeadingGroupTitleProps) => (
  <Typography.Heading
    className={cn(headingSizes[size], className) ?? headingSizes[size]}
    level={level}
    weight="semibold"
    {...props}
  />
);

type HeadingGroupDescriptionProps = Omit<ComponentProps<typeof Typography.Paragraph>, "size"> & {
  size?: HeadingGroupSize;
};

const HeadingGroupDescription = ({
  className,
  size = "md",
  ...props
}: HeadingGroupDescriptionProps) => (
  <Typography.Paragraph
    className={className ?? ""}
    color="muted"
    size={descriptionSizes[size]}
    {...props}
  />
);

type HeadingGroupComponent = typeof HeadingGroupRoot & {
  Title: typeof HeadingGroupTitle;
  Description: typeof HeadingGroupDescription;
};

export const HeadingGroup: HeadingGroupComponent = Object.assign(HeadingGroupRoot, {
  Title: HeadingGroupTitle,
  Description: HeadingGroupDescription,
});

export type { HeadingGroupDescriptionProps, HeadingGroupSize, HeadingGroupTitleProps };
export { HeadingGroupDescription, HeadingGroupRoot, HeadingGroupTitle };
