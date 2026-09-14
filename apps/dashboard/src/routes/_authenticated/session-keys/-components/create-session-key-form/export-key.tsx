// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Encoding, Redacted, Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import type { LocalSessionKeyDraft } from "@namera-ai/sdk";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { CopyIconButton } from "@/components/copy-icon-button";
import { HeadingGroup } from "@/components/heading-group";
import { env } from "@/env";
import { showErrorToast } from "@/lib/toasts";

import { SessionExportForm } from "./export-schema";

export function ExportSessionKey({
  draft,
  bindings,
  onSaved,
}: {
  draft: LocalSessionKeyDraft;
  bindings: ReadonlyArray<LocalEvmSessionBinding>;
  onSaved: () => void;
}) {
  const [command, setCommand] = useState<string>();
  const form = useForm<typeof SessionExportForm.Encoded>({
    defaultValues: { password: "", confirmation: "" },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(SessionExportForm)),
  });
  const submit = form.handleSubmit(async ({ password }) => {
    const secret = Redacted.make(password);
    try {
      const envelope = await draft.seal(new URL(env.backendUrl).origin, bindings, secret);
      setCommand(`namera session-key import ${Encoding.encodeBase64Url(JSON.stringify(envelope))}`);
      form.reset();
    } catch (error) {
      showErrorToast(error, {
        title: "Couldn’t encrypt session key",
        description: "Keep this page open and try again.",
      });
    } finally {
      Redacted.wipeUnsafe(secret);
    }
  });

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <HeadingGroup.Title size="sm">Install the CLI</HeadingGroup.Title>
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface p-3">
          <code className="min-w-0 flex-1 truncate text-xs">npm i -g @namera-ai/cli</code>
          <CopyIconButton label="CLI install command" value="npm i -g @namera-ai/cli" />
        </div>
      </section>
      <section className="grid min-w-0 gap-4">
        <HeadingGroup.Title size="sm">Save your session key</HeadingGroup.Title>
        <Typography.Paragraph color="muted" size="sm">
          Encrypt and save your key before closing this tab. Namera cannot recover it.
        </Typography.Paragraph>
        {command ? (
          <div className="grid gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface p-3">
              <code className="min-w-0 flex-1 truncate text-xs">{command}</code>
              <CopyIconButton label="import command" value={command} />
            </div>
            <Typography.Paragraph color="muted" size="sm">
              Run this command to import your key. Enter your passphrase when asked.
            </Typography.Paragraph>
            <Button variant="tertiary" onPress={onSaved}>
              I imported the key and saved my backup
            </Button>
          </div>
        ) : (
          <form id="export-session-key" noValidate onSubmit={submit}>
            <FieldGroup>
              {(["password", "confirmation"] as const).map((name) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`export-${name}`}>
                        {name === "password" ? "Export passphrase" : "Confirm passphrase"}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={`export-${name}`}
                        type="password"
                        autoComplete="new-password"
                        variant="secondary"
                        fullWidth
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
              <Typography.Paragraph color="muted" size="xs">
                Use at least 12 characters; a generated passphrase is recommended.
              </Typography.Paragraph>
              <Button
                form="export-session-key"
                type="submit"
                isPending={form.formState.isSubmitting}
              >
                Encrypt key
              </Button>
            </FieldGroup>
          </form>
        )}
      </section>
    </div>
  );
}
