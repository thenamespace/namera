import { useNavigate } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { HeadingGroup } from "@/components/heading-group";
import { SessionKeyInstallations } from "@/components/session-key-installations";
import { useSessionKey } from "@/hooks/session-key";

export function ActivateSessionKey({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const query = useSessionKey(sessionKey.id);
  const navigate = useNavigate();
  const active = (query.data ?? sessionKey).status === "active";
  const session = query.data ?? sessionKey;
  const installed = session.installations.filter(
    (installation) => installation.status === "installed",
  ).length;
  const finishSetup = useEventCallback(
    () =>
      void navigate({
        to: "/session-keys/created/$sessionKeyId",
        params: { sessionKeyId: sessionKey.id },
      }),
  );

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
        <Button variant={active ? "primary" : "tertiary"} onPress={finishSetup}>
          {active ? "Continue" : "Skip for now"}
        </Button>
      </section>
    </>
  );
}
