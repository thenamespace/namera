import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { NotificationResponse } from "@namera-ai/protocol/dto";
import type { NotificationType } from "@namera-ai/protocol/model";
import { buttonVariants, Surface, Typography } from "@namera-ai/ui";
import { CopyIconButton } from "@namera-ai/ui";

import { notificationPresentation } from "../data";
import { NotificationIcon } from "../notification-icon";

export type NotificationOf<Type extends NotificationType> = Extract<
  NotificationResponse,
  { readonly notification: { readonly type: Type } }
>;

export function isNotification<Type extends NotificationType>(
  item: NotificationResponse,
  type: Type,
): item is NotificationOf<Type> {
  return item.notification.type === type;
}

type NotificationDetailLayoutProps = {
  readonly children: ReactNode;
  readonly description: string;
  readonly item: NotificationResponse;
};

export function ResourceId({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs text-muted">{value}</span>
      <CopyIconButton className="size-6 min-h-6" label={label} value={value} />
    </div>
  );
}

export function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function DetailList({ children }: { readonly children: ReactNode }) {
  return (
    <Surface
      className="divide-y divide-separator overflow-hidden rounded-xl border"
      variant="secondary"
    >
      <dl>{children}</dl>
    </Surface>
  );
}

export function NotificationDetailLayout({
  children,
  description,
  item,
}: NotificationDetailLayoutProps) {
  const presentation = notificationPresentation[item.notification.type];
  const receivedAt = DateTime.formatLocal(item.receivedAt, {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex items-center gap-4">
        <NotificationIcon
          className="size-12 rounded-lg"
          iconClassName="size-5"
          type={item.notification.type}
        />
        <div className="min-w-0 flex-1">
          <Typography.Heading className="text-xl leading-7 tracking-tight" level={2}>
            {presentation.title}
          </Typography.Heading>
          <Typography className="mt-1 text-xs! leading-4" color="muted">
            {receivedAt}
          </Typography>
        </div>
      </header>

      <Typography.Paragraph className="mt-7 max-w-xl leading-6" color="muted" size="sm">
        {description}
      </Typography.Paragraph>

      <div className="mt-6">{children}</div>
    </article>
  );
}

export function NotificationDetailActions({ children }: { readonly children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>;
}

export function InternalAction({
  children,
  paramName,
  paramValue,
  to,
}: {
  readonly children: ReactNode;
  readonly paramName?: "accountId" | "executionId" | "invitationId" | "sessionKeyId";
  readonly paramValue?: string;
  readonly to: string;
}) {
  const params =
    paramName === undefined || paramValue === undefined ? undefined : { [paramName]: paramValue };

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "tertiary" })}
      to={to}
      {...(params === undefined ? {} : { params })}
    >
      {children}
    </Link>
  );
}
