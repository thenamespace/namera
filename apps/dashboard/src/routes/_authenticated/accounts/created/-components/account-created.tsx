// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Link } from "@tanstack/react-router";

import type { WalletResponse } from "@namera-ai/protocol/dto";
import { buttonVariants, Typography } from "@namera-ai/ui";
import { ArrowRight01Icon, HugeiconsIcon, Key01Icon } from "@namera-ai/ui/icons";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { AccountOverview } from "../../../account/-components/account-overview";

export function AccountCreated({
  account,
  canCreateSessionKey,
}: {
  account: WalletResponse;
  canCreateSessionKey: boolean;
}) {
  return (
    <DashboardPage>
      <DashboardPage.Content className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 md:py-16">
        <AccountOverview account={account} variant="summary" />
        <section className="mt-6">
          <HeadingGroup.Title className="mb-3" size="sm">
            Next steps
          </HeadingGroup.Title>
          {canCreateSessionKey ? (
            <Link
              className={buttonVariants({
                variant: "ghost",
                className:
                  "h-auto min-h-16 w-full justify-start gap-3 rounded-lg bg-default/40 px-3 py-3 text-left whitespace-normal transition-colors hover:bg-default/80",
              })}
              to="/session-keys/new"
              search={{ accountId: account.id }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface/60">
                <HugeiconsIcon aria-hidden className="size-4 text-muted" icon={Key01Icon} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span>Create session key</span>
                <span className="text-xs font-normal text-muted">
                  Set the networks, contracts, and spending limits your agent can use.
                </span>
              </span>
              <HugeiconsIcon
                aria-hidden
                className="ml-auto size-4 shrink-0 text-muted"
                icon={ArrowRight01Icon}
              />
            </Link>
          ) : (
            <Typography.Paragraph color="muted" size="xs">
              Ask a workspace admin to create a session key.
            </Typography.Paragraph>
          )}
        </section>
        <Link
          className={buttonVariants({ variant: "tertiary", size: "sm", className: "mt-6" })}
          to="/account/$accountId/overview"
          params={{ accountId: account.id }}
        >
          View account
        </Link>
      </DashboardPage.Content>
    </DashboardPage>
  );
}
