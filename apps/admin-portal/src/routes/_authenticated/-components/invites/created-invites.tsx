// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { DateTime } from "effect";

import type { CreateBetaInvitesResponse } from "@namera-ai/protocol/dto";
import { Button, toast } from "@namera-ai/ui";

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.danger("Couldn’t copy", { description: "Select and copy the text manually." });
  }
}

export function CreatedInvites({ invites }: typeof CreateBetaInvitesResponse.Type) {
  return (
    <div className="grid min-w-0 gap-4">
      <output className="text-muted text-sm">
        Save these codes now. They cannot be retrieved after closing this dialog.
      </output>
      {invites.length > 1 ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={() =>
            void copy(invites.map((invite) => `${invite.code}\t${invite.url}`).join("\n"))
          }
        >
          Copy all codes and links
        </Button>
      ) : null}
      <ul className="grid max-h-80 gap-4 overflow-y-auto" aria-label="Created invite codes">
        {invites.map((invite) => (
          <li key={invite.id} className="grid min-w-0 gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="select-all text-base">{invite.code}</code>
              <Button
                size="sm"
                variant="tertiary"
                aria-label={`Copy code ${invite.code}`}
                onPress={() => void copy(invite.code)}
              >
                Copy code
              </Button>
            </div>
            <p className="text-muted text-xs">
              Expires{" "}
              {DateTime.formatLocal(invite.expiresAt, { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <p className="text-muted select-all break-all text-xs">{invite.url}</p>
            <p className="text-muted text-xs">Reference: {invite.id.slice(-12)}</p>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Copy join link for ${invite.code}`}
              onPress={() => void copy(invite.url)}
            >
              Copy join link
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
