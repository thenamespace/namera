import { useNavigate } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";

import { HeadingGroup } from "@/components/heading-group";
import { SessionKeyInstallations } from "@/components/session-key-installations";
import { env } from "@/env";
import { useSessionKey } from "@/hooks/session-key";

import { CommandBlock } from "./command-block";

export function ActivateSessionKey({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const query = useSessionKey(sessionKey.id);
  const navigate = useNavigate();
  const active = (query.data ?? sessionKey).status === "active";
  const session = query.data ?? sessionKey;
  const installed = session.installations.filter(
    (installation) => installation.status === "installed",
  ).length;
  const host = new URL(env.backendUrl).origin.replaceAll("'", "'\\''");
  const command = `namera login --host '${host}'`;

  return (
    <>
      <section className="grid gap-3">
        <HeadingGroup.Title size="sm">Enable networks</HeadingGroup.Title>
        <Typography.Paragraph color="muted" size="sm">
          Enable networks now with your passkey, or do this later from the session key overview.
        </Typography.Paragraph>
        <Typography.Paragraph size="xs" color="muted" aria-live="polite" aria-atomic="true">
          {installed} of {session.installations.length} networks enabled. You can enable the rest
          later.
        </Typography.Paragraph>
        <SessionKeyInstallations sessionKey={sessionKey} compact />
        <Button
          variant="tertiary"
          onPress={() =>
            void navigate({
              to: "/session-key/$sessionKeyId/overview",
              params: { sessionKeyId: sessionKey.id },
            })
          }
        >
          View Session key
        </Button>
      </section>
      {active ? (
        <section className="grid min-w-0 gap-3 border-t border-separator pt-5">
          <HeadingGroup.Title size="sm">Ready to use the CLI?</HeadingGroup.Title>
          <Typography.Paragraph color="muted" size="sm">
            {active
              ? "Run this command, then select this key in the browser to give the CLI access."
              : "Available after at least one network is confirmed."}
          </Typography.Paragraph>
          {active ? <CommandBlock command={command} label="Log in command" /> : null}
        </section>
      ) : null}
    </>
  );
}
