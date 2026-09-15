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
  InputGroup,
  Typography,
} from "@namera-ai/ui";
import { HugeiconsIcon, ViewIcon, ViewOffIcon } from "@namera-ai/ui/icons";
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
  const [visible, setVisible] = useState({ password: false, confirmation: false });
  const loginCommand = `namera login --host '${new URL(env.backendUrl).origin.replaceAll("'", "'\\''")}'`;
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
      setVisible({ password: false, confirmation: false });
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
      <section className="grid min-w-0 gap-4">
        <HeadingGroup.Title size="sm">Save your session key</HeadingGroup.Title>
        <Typography.Paragraph color="muted" size="sm">
          {command
            ? "Your key is encrypted. Complete these steps in your terminal."
            : "Encrypt and save your key before closing this tab. Namera cannot recover it."}
        </Typography.Paragraph>
        {command ? (
          <div className="grid gap-3">
            <ol className="grid list-none gap-5 p-0">
              {[
                { title: "Install the CLI", command: "npm i -g @namera-ai/cli" },
                { title: "Log in", command: loginCommand },
                { title: "Import your key", command },
              ].map((step, index) => (
                <li key={step.title} className="grid min-w-0 gap-3">
                  <HeadingGroup.Title level={3} size="sm">
                    {index + 1}. {step.title}
                  </HeadingGroup.Title>
                  <div className="flex min-w-0 items-center gap-2 rounded-lg bg-surface p-3">
                    <code className="min-w-0 flex-1 truncate text-xs">{step.command}</code>
                    <CopyIconButton label={`${step.title} command`} value={step.command} />
                  </div>
                </li>
              ))}
            </ol>
            <Typography.Paragraph color="muted" size="sm">
              Enter your passphrase when importing the key.
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
                      <InputGroup fullWidth variant="secondary">
                        <InputGroup.Input
                          {...field}
                          id={`export-${name}`}
                          type={visible[name] ? "text" : "password"}
                          autoComplete="new-password"
                          aria-invalid={fieldState.invalid}
                        />
                        <InputGroup.Suffix>
                          <Button
                            type="button"
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label={`${visible[name] ? "Hide" : "Show"} ${name === "password" ? "export" : "confirmation"} passphrase`}
                            aria-controls={`export-${name}`}
                            onPress={() =>
                              setVisible((current) => ({ ...current, [name]: !current[name] }))
                            }
                          >
                            <HugeiconsIcon
                              aria-hidden
                              icon={visible[name] ? ViewOffIcon : ViewIcon}
                              size={18}
                            />
                          </Button>
                        </InputGroup.Suffix>
                      </InputGroup>
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
