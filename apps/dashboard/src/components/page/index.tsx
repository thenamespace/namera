import type { ComponentProps, PropsWithChildren } from "react";

import { cn, Sidebar } from "@namera-ai/ui";

const DashboardPageRoot = ({ children }: PropsWithChildren) => {
  return <Sidebar.Main className="bg-background rounded-lg">{children}</Sidebar.Main>;
};

const DashboardPageHeader = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3", className)} {...props}>
      {children}
    </div>
  );
};

const DashboardPageTitle = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("flex flex-row items-center gap-2 text-sm", className)} {...props}>
      <Sidebar.Trigger />
      {children}
    </div>
  );
};

const DashboardPageSide = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
};

const DashboardPageContent = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("p-3", className)} {...props}>
      {children}
    </div>
  );
};

type DashboardPageComponent = typeof DashboardPageRoot & {
  Header: typeof DashboardPageHeader;
  Title: typeof DashboardPageTitle;
  Side: typeof DashboardPageSide;
  Content: typeof DashboardPageContent;
};

export const DashboardPage: DashboardPageComponent = Object.assign(DashboardPageRoot, {
  Header: DashboardPageHeader,
  Title: DashboardPageTitle,
  Side: DashboardPageSide,
  Content: DashboardPageContent,
});

export {
  DashboardPageRoot,
  DashboardPageHeader,
  DashboardPageTitle,
  DashboardPageSide,
  DashboardPageContent,
};
