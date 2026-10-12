import type { ComponentProps } from "react";

import { Card, cn } from "@namera-ai/ui";

const rowClassName =
  "grid min-h-12 min-w-0 grid-cols-1 items-start gap-2 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] sm:gap-6 sm:px-6 sm:[&>*:last-child]:justify-self-end";

const DashboardCardRoot = ({ className, ...props }: ComponentProps<typeof Card>) => (
  <Card
    className={cn("overflow-hidden rounded-xl border px-2 py-1 shadow-sm", className) ?? ""}
    {...props}
  />
);

const DashboardCardContent = ({ className, ...props }: ComponentProps<typeof Card.Content>) => (
  <Card.Content className={cn("divide-separator divide-y p-0", className) ?? ""} {...props} />
);

const DashboardCardRow = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn(rowClassName, "sm:items-center", className)} {...props} />
);

export { DashboardCardContent, DashboardCardRoot, DashboardCardRow };
