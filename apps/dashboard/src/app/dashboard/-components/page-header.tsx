import type { ComponentProps, ReactNode } from "react";

import { cn } from "@namera-ai/ui/lib/utils";

type PageHeaderProps = ComponentProps<"div"> & {
  header: ReactNode;
  noBorder?: boolean;
};

export const PageHeader = ({
  header,
  className,
  noBorder = false,
  children,
  ...props
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex h-10 flex-row items-center justify-between px-6",
        noBorder ? "" : "border-b-[0.5px]",
        className,
      )}
      {...props}
    >
      <div className="text-[13px]">{header}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
};
