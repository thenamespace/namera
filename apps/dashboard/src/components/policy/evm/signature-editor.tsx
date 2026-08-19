import type { ComponentProps, FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSignaturePolicy } from "@namera-ai/protocol";
import { CheckboxButtonGroup, Field, FieldGroup, FieldLabel, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, Message01Icon, SourceCodeIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { evmPolicyFormIds } from "./data";
import type { EvmPolicyInput, SignaturePolicyInput } from "./types";

type SignaturePolicyValues = typeof CreateEvmSignaturePolicy.Type;

const signatureOptions = [
  {
    id: "message",
    name: "Messages",
    description: "Sign human-readable text and authentication challenges.",
    icon: Message01Icon,
  },
  {
    id: "typed-data",
    name: "Typed data",
    description: "Sign structured EIP-712 requests for apps and protocols.",
    icon: SourceCodeIcon,
  },
] satisfies ReadonlyArray<{
  id: SignaturePolicyInput["allowedTypes"][number];
  name: string;
  description: string;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
}>;

const emptySignaturePolicy: SignaturePolicyInput = {
  type: "evm.signature",
  version: 1,
  allowedTypes: [],
};

type SignaturePolicyEditorProps = {
  formId?: string;
  initialValue?: SignaturePolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};

export function SignaturePolicyEditor({
  formId = evmPolicyFormIds["evm.signature"],
  initialValue = emptySignaturePolicy,
  onSave,
}: SignaturePolicyEditorProps) {
  const form = useForm<SignaturePolicyInput, unknown, SignaturePolicyValues>({
    defaultValues: initialValue,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateEvmSignaturePolicy)),
  });
  const submitPolicy = form.handleSubmit((policy) => {
    onSave(Schema.encodeSync(CreateEvmSignaturePolicy)(policy));
  });
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submitPolicy(event);
  });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Controller
          control={form.control}
          name="allowedTypes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Allowed signatures</FieldLabel>
              <CheckboxButtonGroup
                aria-label="Allowed signature types"
                isInvalid={fieldState.invalid}
                layout="grid"
                name={field.name}
                value={Array.from(field.value)}
                onBlur={field.onBlur}
                onChange={field.onChange}
              >
                {signatureOptions.map((option) => (
                  <CheckboxButtonGroup.Item key={option.id} value={option.id}>
                    <CheckboxButtonGroup.ItemIcon>
                      <HugeiconsIcon icon={option.icon} />
                    </CheckboxButtonGroup.ItemIcon>
                    <CheckboxButtonGroup.ItemContent>
                      <span className="text-sm font-medium">{option.name}</span>
                      <span className="text-muted text-xs">{option.description}</span>
                    </CheckboxButtonGroup.ItemContent>
                    <CheckboxButtonGroup.Indicator />
                  </CheckboxButtonGroup.Item>
                ))}
              </CheckboxButtonGroup>
              {fieldState.invalid ? (
                <Typography.Paragraph className="text-danger" role="alert" size="xs">
                  {fieldState.error?.message ?? "Select at least one signature type"}
                </Typography.Paragraph>
              ) : null}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
