import type { ActorType } from "@namera-ai/protocol/model";
import { Typography } from "@namera-ai/ui";
import { ApiIcon, BotIcon, HugeiconsIcon, TerminalIcon, UserCircleIcon } from "@namera-ai/ui/icons";

const actorDisplay = {
  "api-key": { icon: ApiIcon, label: "API key" },
  cli: { icon: TerminalIcon, label: "CLI" },
  mcp: { icon: BotIcon, label: "MCP" },
  user: { icon: UserCircleIcon, label: "User" },
} as const satisfies Record<ActorType, { icon: typeof ApiIcon; label: string }>;

type ExecutionActorDisplayProps = {
  type: ActorType;
};

export function ExecutionActorDisplay({ type }: ExecutionActorDisplayProps) {
  const display = actorDisplay[type];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <HugeiconsIcon className="size-4 shrink-0 text-muted" icon={display.icon} />
      <Typography className="truncate text-sm!" weight="normal">
        {display.label}
      </Typography>
    </div>
  );
}

export { actorDisplay };
export type { ExecutionActorDisplayProps };
