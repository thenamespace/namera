import type { GetAdminOverviewResponse } from "@namera-ai/protocol/dto";
import { KPI, Typography } from "@namera-ai/ui";
import {
  Activity02Icon,
  Key01Icon,
  SignatureIcon,
  Wallet01Icon,
  UserGroupIcon,
  InboxIcon,
  HugeiconsIcon,
} from "@namera-ai/ui/icons";

const number = new Intl.NumberFormat();

export function OverviewKpis({ overview }: { overview: GetAdminOverviewResponse }) {
  const { totals, current, periodCounts, period } = overview;
  const cards = [
    {
      title: "Users",
      icon: UserGroupIcon,
      total: totals.users,
      detail: `${number.format(periodCounts.users)} new in ${period}`,
    },
    {
      title: "Waitlist",
      icon: InboxIcon,
      total: totals.waitlist,
      detail: `${number.format(current.pendingWaitlist)} pending · ${number.format(periodCounts.waitlist)} new in ${period}`,
    },
    {
      title: "Smart accounts",
      icon: Wallet01Icon,
      total: totals.accounts,
      detail: `${number.format(periodCounts.accounts)} created in ${period}`,
    },
    {
      title: "Session keys",
      icon: Key01Icon,
      total: totals.sessionKeys,
      detail: `${number.format(current.activeSessionKeys)} active · ${number.format(current.revokedSessionKeys)} revoked`,
    },
    {
      title: "Confirmed executions",
      icon: Activity02Icon,
      total: totals.executions,
      detail: `${number.format(periodCounts.executions)} confirmed in ${period}`,
    },
    {
      title: "Successful signatures",
      icon: SignatureIcon,
      total: totals.signatures,
      detail: `${number.format(periodCounts.signatures)} signed in ${period}`,
    },
  ];
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <KPI key={card.title} className="min-w-0 border p-3">
          <KPI.Header className="gap-1.5!">
            <KPI.Icon className="size-5 text-muted">
              <HugeiconsIcon icon={card.icon} />
            </KPI.Icon>
            <KPI.Title>{card.title}</KPI.Title>
          </KPI.Header>
          <KPI.Content className="block! pt-3">
            <KPI.Value
              className="text-2xl! leading-none!"
              value={card.total}
              maximumFractionDigits={0}
            />
            <Typography.Paragraph className="mt-2" color="muted" size="xs">
              {card.detail}
            </Typography.Paragraph>
          </KPI.Content>
        </KPI>
      ))}
    </dl>
  );
}
