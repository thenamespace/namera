import { type ReactNode, useMemo } from "react";

import { Link, useParams } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { cn } from "@namera-ai/ui";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

const sessionKeySections = [
  { label: "Overview", to: "/session-key/$sessionKeyId/overview" },
  { label: "Policies", to: "/session-key/$sessionKeyId/policies" },
  { label: "Executions", to: "/session-key/$sessionKeyId/executions" },
] as const;
const exactActiveOptions = { exact: true } as const;
const activeTabProps = { className: "bg-surface text-foreground" } as const;
const tabClassName = cn(
  "rounded-md px-3 py-1.5 text-sm text-muted transition-colors",
  "hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
);

type SessionKeyShellProps = {
  children: ReactNode;
  sessionKey: SessionKeyResponse;
};

export function SessionKeyShell({ children, sessionKey }: SessionKeyShellProps) {
  const { sessionKeyId } = useParams({ from: "/_authenticated/session-key/$sessionKeyId" });
  const sessionKeyParams = useMemo(() => ({ sessionKeyId }), [sessionKeyId]);

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <Link className="text-muted transition-colors hover:text-foreground" to="/session-keys">
            Session Keys
          </Link>
          <span aria-hidden className="text-muted">
            /
          </span>
          <HeadingGroup.Title level={1} weight="normal" className="truncate text-base">
            {sessionKey.metadata.name}
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>

      <nav aria-label="Session key sections" className="px-4 sm:px-6">
        <div className="flex h-12 items-center gap-1">
          {sessionKeySections.map((section) => (
            <Link
              activeOptions={exactActiveOptions}
              activeProps={activeTabProps}
              className={tabClassName}
              key={section.to}
              params={sessionKeyParams}
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

export type { SessionKeyShellProps };
