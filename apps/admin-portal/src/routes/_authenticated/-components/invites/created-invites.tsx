// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { DateTime } from "effect";

import type { CreateBetaInvitesResponse } from "@namera-ai/protocol/dto";
import { Button, toast } from "@namera-ai/ui";

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.danger("Couldn’t copy", { description: "Allow clipboard access and try again." });
  }
}

export function CreatedInvites({ invites }: typeof CreateBetaInvitesResponse.Type) {
  return (
    <div className="grid min-w-0 gap-4">
      <output className="text-muted text-sm">
        Copy your invite links before closing. They won’t be shown again.
      </output>
      {invites.length > 1 ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={() => void copy(invites.map((invite) => invite.url).join("\n"))}
        >
          Copy all invite links
        </Button>
      ) : null}
      <ul className="grid max-h-80 gap-2 overflow-y-auto" aria-label="Created invite links">
        {invites.map((invite, index) => (
          <li
            key={invite.id}
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2 text-xs">
              <code className="select-all">{invite.code}</code>
              <span aria-hidden="true" className="text-muted">
                |
              </span>
              <span className="text-muted">
                Expires {DateTime.formatLocal(invite.expiresAt, { day: "numeric", month: "short" })}
              </span>
            </div>
            <Button
              size="sm"
              variant="tertiary"
              aria-label={invites.length > 1 ? `Copy invite link ${index + 1}` : "Copy invite link"}
              onPress={() => void copy(invite.url)}
            >
              Copy invite link
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
