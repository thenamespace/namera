import type { BetaInviteStatus } from "@namera-ai/protocol/model";

/**
 * Status is text first, with the dot as a secondary cue: colour alone would be
 * invisible to a colour-blind operator and in forced-colours mode. Every colour
 * used here clears 4.5:1 against the page background.
 */
const tone = {
  active: "text-success",
  redeemed: "text-foreground",
  revoked: "text-danger",
  expired: "text-muted",
  pending: "text-warning",
  completed: "text-success",
} as const;

export function StatusLabel({ status }: { readonly status: keyof typeof tone }) {
  return (
    <span className={`inline-flex items-center gap-2 ${tone[status]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

export const inviteStatuses: ReadonlyArray<BetaInviteStatus> = [
  "active",
  "redeemed",
  "revoked",
  "expired",
];
