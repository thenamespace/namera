// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import type { CreateSessionKeyResponse } from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import type { LocalSessionKeyDraft } from "@namera-ai/sdk";
import { Stepper, Typography } from "@namera-ai/ui";

import { ActivateSessionKey } from "./activate-key";
import { ExportSessionKey } from "./export-key";

const steps = [
  { title: "Encrypt key", description: "Protect your key with a passphrase." },
  {
    title: "Install & import",
    description: "Install the CLI, then import your key.",
  },
  {
    title: "Enable networks",
    description: "Approve with your passkey now, or return to this later.",
  },
];

export function SetupSessionKey({
  sessionKey,
  draft,
  bindings,
  onSaved,
}: {
  sessionKey: CreateSessionKeyResponse;
  draft: LocalSessionKeyDraft;
  bindings: ReadonlyArray<LocalEvmSessionBinding>;
  onSaved: () => void;
}) {
  const [encrypted, setEncrypted] = useState(false);
  const [saved, setSaved] = useState(false);
  const step = saved ? 2 : encrypted ? 1 : 0;

  return (
    <div className="grid min-w-0 gap-6">
      <Stepper
        aria-label="Session key setup"
        currentStep={step}
        orientation="vertical"
        size="md"
        className="w-full [--stepper-vertical-gap:20px] [--stepper-inactive-border:var(--muted)] [&_[data-slot=stepper-separator-track]]:bg-muted/40 motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none"
      >
        {steps.map(({ title, description }, index) => (
          <Stepper.Step key={title}>
            <Stepper.Indicator />
            <Stepper.Content className="min-w-0 pt-0.5">
              <Stepper.Title>{title}</Stepper.Title>
              <Stepper.Description className="text-[11px] leading-4">
                {description}
              </Stepper.Description>
              {index < step ? <span className="sr-only">Completed</span> : null}
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="rounded-lg border border-separator bg-surface p-4"
      >
        <Typography.Paragraph size="sm">
          {saved
            ? "Your CLI import is confirmed."
            : "Keep this page open until your key is imported."}
        </Typography.Paragraph>
        <Typography.Paragraph size="xs" color="muted" className="mt-1">
          {saved
            ? "You can leave now and enable networks later from the session key overview."
            : "Namera cannot recover this key. Encryption alone does not save it."}
        </Typography.Paragraph>
      </div>
      {!saved ? (
        <ExportSessionKey
          draft={draft}
          bindings={bindings}
          onEncrypted={() => setEncrypted(true)}
          onSaved={() => {
            setSaved(true);
            onSaved();
          }}
        />
      ) : (
        <ActivateSessionKey sessionKey={sessionKey} />
      )}
    </div>
  );
}
