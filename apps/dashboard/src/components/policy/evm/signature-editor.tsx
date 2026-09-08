import type { ComponentProps, FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSignaturePolicy } from "@namera-ai/protocol";
import {
  Button,
  CheckboxButtonGroup,
  Field,
  FieldGroup,
  FieldLabel,
  Typography,
} from "@namera-ai/ui";
import { HugeiconsIcon, Message01Icon, SourceCodeIcon } from "@namera-ai/ui/icons";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { evmPolicyFormIds } from "./data";
import {
  SignaturePolicyForm,
  toSignatureFormInput,
  type SignatureFormInput,
} from "./signature-form";
import { SignatureRuleFields } from "./signature-rule-fields";
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
  const form = useForm<SignatureFormInput, unknown, SignaturePolicyValues>({
    defaultValues: toSignatureFormInput(initialValue),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(SignaturePolicyForm)),
  });
  const rules = useFieldArray({ control: form.control, name: "rules" });
  const allowedTypes = useWatch({ control: form.control, name: "allowedTypes" });
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
                onChange={(value) => {
                  field.onChange(value);
                  if (!value.includes("typed-data")) rules.replace([]);
                }}
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
        {allowedTypes.includes("typed-data") ? (
          <>
            <Typography.Paragraph color="muted" size="xs">
              Allow only matching networks, contracts and message types. Names and versions are
              exact when matching is enabled. These API rules do not restrict signing outside Namera
              or amounts inside a message.
            </Typography.Paragraph>
            {rules.fields.map((rule, index) => (
              <SignatureRuleFields
                key={rule.id}
                control={form.control}
                index={index}
                onRemove={() => rules.remove(index)}
              />
            ))}
            {form.formState.errors.rules ? (
              <Typography.Paragraph className="text-danger" role="alert" size="xs">
                {form.formState.errors.rules.message ?? form.formState.errors.rules.root?.message}
              </Typography.Paragraph>
            ) : null}
            <Button
              type="button"
              variant="tertiary"
              onPress={() =>
                rules.append({
                  chainId: "eip155:1",
                  verifyingContract: "",
                  name: "",
                  version: "",
                  matchName: false,
                  matchVersion: false,
                  primaryTypes: "",
                })
              }
            >
              Add typed-data rule
            </Button>
          </>
        ) : null}
      </FieldGroup>
    </form>
  );
}
