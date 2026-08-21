import { type ReactNode, useMemo } from "react";

import { Link, useParams } from "@tanstack/react-router";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import { cn } from "@namera-ai/ui";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

const accountSections = [
  { label: "Overview", to: "/account/$accountId/overview" },
  { label: "Assets", to: "/account/$accountId/assets" },
  { label: "Session Keys", to: "/account/$accountId/session-keys" },
  { label: "Usage", to: "/account/$accountId/usage" },
] as const;
const exactActiveOptions = { exact: true } as const;
const activeTabProps = { className: "bg-surface text-foreground" } as const;
const tabClassName = cn(
  "rounded-md px-3 py-1.5 text-sm text-muted transition-colors",
  "hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

type AccountShellProps = {
  account: WalletResponse | undefined;
  children: ReactNode;
};

export function AccountShell({ account, children }: AccountShellProps) {
  const { accountId } = useParams({ from: "/_authenticated/account/$accountId" });
  const accountParams = useMemo(() => ({ accountId }), [accountId]);

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <Link className="text-muted transition-colors hover:text-foreground" to="/accounts">
            Accounts
          </Link>
          <span aria-hidden className="text-muted">
            /
          </span>
          <HeadingGroup.Title level={1} weight="normal" className="truncate text-base">
            {account?.metadata.name ?? "Account"}
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>

      <nav aria-label="Account sections" className="px-4 sm:px-6">
        <div className="flex h-12 items-center gap-1">
          {accountSections.map((section) => (
            <Link
              activeOptions={exactActiveOptions}
              activeProps={activeTabProps}
              className={tabClassName}
              key={section.to}
              params={accountParams}
              to={section.to}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </nav>

      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">{children}</DashboardPage.Content>
    </DashboardPage>
  );
}

export type { AccountShellProps };
