// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Redacted, Schema } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import type { LocalSessionKeyDraft } from "@namera-ai/sdk";
import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  InputGroup,
  Typography,
} from "@namera-ai/ui";
import { HugeiconsIcon, ViewIcon, ViewOffIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { env } from "@/env";
import { showErrorToast } from "@/lib/toasts";

import { CommandBlock } from "./command-block";
import { SessionExportForm } from "./export-schema";

export function ExportSessionKey({
  draft,
  bindings,
  onSaved,
  onEncrypted,
}: {
  draft: LocalSessionKeyDraft;
  bindings: ReadonlyArray<LocalEvmSessionBinding>;
  onSaved: () => void;
  onEncrypted: () => void;
}) {
  const [command, setCommand] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [visible, setVisible] = useState({ password: false, confirmation: false });
  const form = useForm<typeof SessionExportForm.Encoded>({
    defaultValues: { password: "", confirmation: "" },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(SessionExportForm)),
  });
  const submit = form.handleSubmit(async ({ password }) => {
    const secret = Redacted.make(password);
    try {
      const envelope = await draft.seal(new URL(env.backendUrl).origin, bindings, secret);
      const host = new URL(env.backendUrl).origin.replaceAll("'", "'\\''");
      setCommand(
        `namera session-key import ${Base64Url.encode(JSON.stringify(envelope))} --host '${host}'`,
      );
      form.reset();
      setVisible({ password: false, confirmation: false });
      onEncrypted();
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
        <HeadingGroup.Title size="sm">
          {command ? "Install the CLI and import" : "Encrypt your session key"}
        </HeadingGroup.Title>
        {!command ? (
          <Typography.Paragraph color="muted" size="sm">
            Choose a passphrase to encrypt your key for import.
          </Typography.Paragraph>
        ) : null}
        {command ? (
          <div className="grid gap-3">
            <ol className="grid list-none gap-5 p-0">
              {[
                { title: "Install the CLI", command: "npm i -g @namera-ai/cli@latest" },
                { title: "Import your key", command },
              ].map((step, index) => (
                <li key={step.title} className="grid min-w-0 gap-0">
                  <HeadingGroup.Title level={3} size="sm">
                    {index + 1}. {step.title}
                  </HeadingGroup.Title>
                  <CommandBlock command={step.command} label={`${step.title} command`} />
                </li>
              ))}
            </ol>
            <Checkbox isSelected={confirmed} onChange={setConfirmed}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                The CLI confirmed my key was imported successfully.
              </Checkbox.Content>
            </Checkbox>
            <Button isDisabled={!confirmed} onPress={onSaved}>
              Confirm import and continue
            </Button>
          </div>
        ) : (
          <form id="export-session-key" autoComplete="off" noValidate onSubmit={submit}>
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
                      {fieldState.error ? (
                        <FieldError>
                          {name === "password"
                            ? "Use at least 8 characters."
                            : "Enter the same passphrase in both fields."}
                        </FieldError>
                      ) : null}
                      <InputGroup fullWidth variant="secondary">
                        <InputGroup.Input
                          {...field}
                          id={`export-${name}`}
                          type={visible[name] ? "text" : "password"}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          data-bwignore="true"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
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
                    </Field>
                  )}
                />
              ))}
              <Typography.Paragraph color="muted" size="xs">
                Use at least 8 characters. A longer, unique passphrase is recommended.
              </Typography.Paragraph>
              <Button
                form="export-session-key"
                type="submit"
                isPending={form.formState.isSubmitting}
              >
                Encrypt and continue
              </Button>
            </FieldGroup>
          </form>
        )}
      </section>
    </div>
  );
}
