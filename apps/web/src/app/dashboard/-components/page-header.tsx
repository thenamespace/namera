import type { ComponentProps, ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

type PageHeaderProps = ComponentProps<"div"> & {
  header: ReactNode;
};

export const PageHeader = ({
  header,
  className,
  children,
  ...props
}: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between border-b-[0.5px] h-10 px-6",
        className,
      )}
      {...props}
    >
      <div className="text-[13px]">{header}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
};
