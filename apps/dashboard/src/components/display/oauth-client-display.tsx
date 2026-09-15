import type { OAuthClientResponse } from "@namera-ai/protocol/dto";
import { Avatar, Typography } from "@namera-ai/ui";
import { BotIcon, BrandClaudeIcon, BrandOpenaiIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { getOAuthClientName } from "./oauth-client-name";

type OAuthClientDisplayProps = {
  client: OAuthClientResponse;
};

export function OAuthClientDisplay({ client }: OAuthClientDisplayProps) {
  const name = getOAuthClientName(client.clientName);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-6 shrink-0 rounded-md">
        {client.logoUri === null ? null : <Avatar.Image alt="" src={client.logoUri} />}
        <Avatar.Fallback>
          {name === "Codex" ? (
            <BrandOpenaiIcon aria-hidden className="size-3.5" />
          ) : name === "Claude Code" ? (
            <BrandClaudeIcon aria-hidden className="size-3.5" />
          ) : (
            <HugeiconsIcon aria-hidden className="size-3.5" icon={BotIcon} />
          )}
        </Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <Typography className="truncate text-sm! leading-[1.2]" weight="normal">
          {name}
        </Typography>
      </div>
    </div>
  );
}

export type { OAuthClientDisplayProps };
