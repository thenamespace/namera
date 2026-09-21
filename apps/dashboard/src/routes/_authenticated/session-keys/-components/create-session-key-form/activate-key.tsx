import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";
import { HeadingGroup } from "@/components/heading-group";
import { SessionKeyInstallations } from "@/components/session-key-installations";
import { useSessionKey } from "@/hooks/session-key";

export function ActivateSessionKey({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const query = useSessionKey(sessionKey.id);
  const active = (query.data ?? sessionKey).status === "active";
  const command = "namera login";

  return (
    <>
      <section className="grid gap-3">
        <HeadingGroup.Title size="sm">3. Approve a network</HeadingGroup.Title>
        <SessionKeyInstallations sessionKey={sessionKey} />
      </section>
      <section className="grid min-w-0 gap-3">
        <HeadingGroup.Title size="sm">4. Log in to the CLI</HeadingGroup.Title>
        <Typography.Paragraph color="muted" size="sm">
          {active
            ? "Run this command, then select your session key in the browser."
            : "Approve at least one network first. Your key will then be available during login."}
        </Typography.Paragraph>
        {active ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface p-3">
            <code className="min-w-0 flex-1 truncate text-xs">{command}</code>
            <CopyIconButton label="Log in command" value={command} />
          </div>
        ) : null}
      </section>
    </>
  );
}
