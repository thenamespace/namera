import type { ComponentProps } from "react";

import { Typography, cn } from "@namera-ai/ui";
import { HugeiconsIcon, LockPasswordIcon } from "@namera-ai/ui/icons";

type PermissionDeniedProps = ComponentProps<"div"> & {
  readonly description?: string;
  readonly title?: string;
};

export function PermissionDenied({
  className,
  description = "You don't have permission to access this page.",
  title = "Not enough permissions",
  ...props
}: PermissionDeniedProps) {
  return (
    <div
      className={cn("flex min-h-72 flex-col items-center justify-center text-center", className)}
      {...props}
    >
      <div className="bg-surface mb-4 flex size-10 items-center justify-center rounded-lg">
        <HugeiconsIcon aria-hidden="true" icon={LockPasswordIcon} size={20} />
      </div>
      <Typography.Heading className="text-lg" level={1} weight="medium">
        {title}
      </Typography.Heading>
      <Typography.Paragraph className="mt-1 max-w-sm" color="muted" size="sm">
        {description}
      </Typography.Paragraph>
    </div>
  );
}
