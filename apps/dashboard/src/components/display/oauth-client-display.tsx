import type { OAuthClientResponse } from "@namera-ai/protocol/dto";
import { Avatar, Typography } from "@namera-ai/ui";
import { BotIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

type OAuthClientDisplayProps = {
  client: OAuthClientResponse;
};

export function OAuthClientDisplay({ client }: OAuthClientDisplayProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-6 shrink-0 rounded-md">
        {client.logoUri === null ? null : <Avatar.Image alt="" src={client.logoUri} />}
        <Avatar.Fallback>
          <HugeiconsIcon className="size-3.5" icon={BotIcon} />
        </Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <Typography className="truncate text-sm! leading-[1.2]" weight="normal">
          {client.clientName}
        </Typography>
        <Typography className="truncate text-xs! leading-[1.2]" color="muted">
          {client.clientUri ?? client.clientId}
        </Typography>
      </div>
    </div>
  );
}

export type { OAuthClientDisplayProps };
