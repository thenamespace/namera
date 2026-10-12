import type { ComponentProps, PropsWithChildren } from "react";

import { cn, Sidebar } from "@namera-ai/ui";

import { NavigationTrigger } from "@/components/sidebar/navigation-trigger";

import { PagePanelContext } from "./context";

const DashboardPageRoot = ({ children }: PropsWithChildren) => {
  return (
    <Sidebar.Main className="bg-background rounded-lg">
      <PagePanelContext.Provider value={true}>{children}</PagePanelContext.Provider>
    </Sidebar.Main>
  );
};

const DashboardPageHeader = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "dashboard-page-header flex items-center justify-between gap-3 px-4 py-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const DashboardPageTitle = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("flex min-w-0 flex-row items-center gap-2 text-sm", className)} {...props}>
      <NavigationTrigger />
      {children}
    </div>
  );
};

const DashboardPageSide = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("shrink-0", className)} {...props}>
      {children}
    </div>
  );
};

const DashboardPageContent = ({ children, className, ...props }: ComponentProps<"div">) => {
  return (
    <div className={cn("dashboard-page-content min-w-0 p-3", className)} {...props}>
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
