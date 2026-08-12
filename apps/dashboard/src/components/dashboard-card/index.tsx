import type { ComponentProps } from "react";

import { Card, TextField, cn } from "@namera-ai/ui";

const rowClassName =
  "grid min-h-20 grid-cols-1 items-start gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] sm:items-center sm:gap-6 sm:px-6";

const DashboardCardRoot = ({ className, ...props }: ComponentProps<typeof Card>) => (
  <Card className={cn("overflow-hidden rounded-xl border p-2", className) ?? ""} {...props} />
);

const DashboardCardContent = ({ className, ...props }: ComponentProps<typeof Card.Content>) => (
  <Card.Content className={cn("divide-separator divide-y p-0", className) ?? ""} {...props} />
);

const DashboardCardRow = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn(rowClassName, className)} {...props} />
);

type DashboardCardFieldProps = Omit<ComponentProps<typeof TextField>, "className"> & {
  className?: string;
};

const DashboardCardField = ({ className, ...props }: DashboardCardFieldProps) => (
  <TextField className={cn(rowClassName, className) ?? rowClassName} {...props} />
);

type DashboardCardComponent = typeof DashboardCardRoot & {
  Content: typeof DashboardCardContent;
  Field: typeof DashboardCardField;
  Row: typeof DashboardCardRow;
};

export const DashboardCard: DashboardCardComponent = Object.assign(DashboardCardRoot, {
  Content: DashboardCardContent,
  Field: DashboardCardField,
  Row: DashboardCardRow,
});

export { DashboardCardContent, DashboardCardField, DashboardCardRoot, DashboardCardRow };
