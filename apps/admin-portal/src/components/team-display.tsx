import { useCallback } from "react";

import { DateTime } from "effect";

import type { PlatformMember, UserMetadata } from "@namera-ai/protocol/model";
import { IconPreview, Tooltip, Typography, toast } from "@namera-ai/ui";
import {
  CrownIcon,
  HugeiconsIcon,
  UserIcon,
  UserShield01Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  PauseCircleIcon,
} from "@namera-ai/ui/icons";

const fallbackIcon = { type: "emoji", value: "👤" } as const;
const rolePresentation = {
  owner: {
    label: "Owner",
    icon: CrownIcon,
  },
  operator: {
    label: "Operator",
    icon: UserShield01Icon,
  },
  viewer: {
    label: "Viewer",
    icon: UserIcon,
  },
};
const statusPresentation = {
  active: { label: "Active" },
  suspended: {
    label: "Suspended",
  },
  removed: {
    label: "Removed",
  },
} as const;

export function MemberDisplay({ email, metadata }: { email: string; metadata: UserMetadata }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IconPreview size="xs" value={metadata.image ?? fallbackIcon} />
      <Typography className="truncate text-sm! leading-[1.2]" weight="normal">
        {metadata.name ?? email}
      </Typography>
    </div>
  );
}

export function EmailDisplay({ email }: { email: string }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard");
    } catch {
      toast.danger("Couldn’t copy email", { description: "Select and copy the email manually." });
    }
  }, [email]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${email}`}
      className="text-muted hover:text-foreground h-auto min-w-0 justify-start p-0 cursor-pointer transition-all duration-100 ease-in-out"
    >
      <span className="truncate">{email}</span>
    </button>
  );
}

export function RoleDisplay({ role }: { role: PlatformMember["role"] }) {
  const presentation = rolePresentation[role];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <HugeiconsIcon
        icon={presentation.icon}
        className={role === "owner" ? "size-4 shrink-0 text-accent" : "size-4 shrink-0 text-muted"}
      />
      <span className="truncate text-foreground">{presentation.label}</span>
    </span>
  );
}

export function MemberStatusDisplay({ status }: { status: PlatformMember["status"] }) {
  const presentation = statusPresentation[status];
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <HugeiconsIcon
        icon={
          status === "active"
            ? CheckmarkCircle02Icon
            : status === "suspended"
              ? PauseCircleIcon
              : CancelCircleIcon
        }
        className={
          status === "active"
            ? "size-4 shrink-0 text-success"
            : status === "suspended"
              ? "size-4 shrink-0 text-warning"
              : "size-4 shrink-0 text-danger"
        }
      />
      <span className="truncate text-foreground">{presentation.label}</span>
    </span>
  );
}

export function JoinedDisplay({ value }: { value: DateTime.DateTime }) {
  const date = DateTime.formatLocal(value, { day: "numeric", month: "short", year: "numeric" });
  const fullDate = DateTime.formatLocal(value, { dateStyle: "medium", timeStyle: "short" });
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={`Joined at ${fullDate}`}
        className="text-muted cursor-help text-sm tabular-nums"
      >
        {date}
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        Joined at {fullDate}
      </Tooltip.Content>
    </Tooltip>
  );
}
