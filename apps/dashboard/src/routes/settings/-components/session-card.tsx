import { DateTime } from "effect";

import type { GetSessionResponse } from "@namera-ai/protocol/dto";
import { Button, Chip, ItemCard } from "@namera-ai/ui";
import { HugeiconsIcon, LogoutSquare01Icon } from "@namera-ai/ui/icons";
import { UAParser } from "ua-parser-js";

import { DeviceIcon } from "@/components";

interface SessionCardProps {
  isCurrent?: boolean;
  session: GetSessionResponse;
}

export function SessionCard({ isCurrent = false, session }: SessionCardProps) {
  const userAgent = new UAParser(session.userAgent ?? undefined).getResult();
  const browser = userAgent.browser.name ?? "Browser";
  const os = userAgent.os.name ?? "Unknown device";
  const label = `${browser} on ${os}`;

  return (
    <ItemCard className="group min-h-16 border" variant="default">
      <ItemCard.Icon>
        <DeviceIcon aria-hidden browser={browser} os={os} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title className="flex max-w-full items-center gap-2">
          <span className="truncate">{label}</span>
          {isCurrent ? (
            <Chip color="success" size="sm" variant="soft">
              Current
            </Chip>
          ) : null}
        </ItemCard.Title>
        <ItemCard.Description>
          Logged in{" "}
          {DateTime.formatLocal(session.createdAt, { dateStyle: "medium", timeStyle: "short" })}
        </ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action className="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Button aria-label={`Log out ${label}`} size="sm" type="button" variant="danger-soft">
          <HugeiconsIcon icon={LogoutSquare01Icon} />
          Log out
        </Button>
      </ItemCard.Action>
    </ItemCard>
  );
}
