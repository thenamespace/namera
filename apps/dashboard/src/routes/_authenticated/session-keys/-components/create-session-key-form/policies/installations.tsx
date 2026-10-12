// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useState, type ComponentProps } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Field, FieldLabel, FieldError, Typography } from "@namera-ai/ui";
import { Controller, useWatch } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";

import { PolicySection } from "./index";
import { selectInstallationNetworks } from "./installation-selection";

type Props = Omit<
  ComponentProps<typeof PolicySection>,
  "installationIndex" | "onSaveTokenSelection"
> & {
  onSaveTokenSelection: (chainId: SupportedEvmChainId, selection: TokenSpendingSelection) => void;
};

export function InstallationPolicies({ form, onSaveTokenSelection, ...props }: Props) {
  const installations = useWatch({ control: form.control, name: "onchain.installations" });
  const [removalError, setRemovalError] = useState<string>();
  return (
    <section className="grid gap-6">
      <HeadingGroup>
        <HeadingGroup.Title size="sm">Policies</HeadingGroup.Title>
        <HeadingGroup.Description>
          Choose networks, then configure access and limits for each one.
        </HeadingGroup.Description>
      </HeadingGroup>
      <Controller
        control={form.control}
        name="onchain.installations"
        render={({ field, fieldState }) => (
          <Field data-invalid={Boolean(fieldState.error?.message || removalError)}>
            <FieldLabel id="session-networks-label">Networks</FieldLabel>
            <EvmNetworkMultiSelect
              aria-labelledby="session-networks-label"
              operationalOnly
              isDisabled={props.editing}
              name={field.name}
              value={field.value.map(({ chainId }) => chainId)}
              onBlur={field.onBlur}
              triggerRef={field.ref}
              onChange={(chainIds) => {
                const rules = form
                  .getValues("policies")
                  .flatMap((policy) =>
                    policy.type === "evm.signature" ? (policy.typedDataRules ?? []) : [],
                  );
                if (rules.some((rule) => !chainIds.includes(rule.chainId))) {
                  setRemovalError(
                    "Remove this network’s typed-data rules before removing the network.",
                  );
                  return;
                }
                setRemovalError(undefined);
                field.onChange(
                  selectInstallationNetworks(
                    form.getValues("onchain.installations"),
                    chainIds,
                    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                  ),
                );
                if (
                  !form
                    .getValues("onchain.installations")
                    .some(({ allowSignatures }) => allowSignatures)
                ) {
                  form.setValue("policies", [], { shouldDirty: true });
                }
              }}
            />
            <Typography.Paragraph size="xs" className="text-muted">
              Configure each network separately. New networks start without access; removing one
              discards its configuration.
            </Typography.Paragraph>
            {removalError ? <FieldError>{removalError}</FieldError> : null}
            <FieldError
              errors={[fieldState.error, form.formState.errors.onchain?.installations?.root]}
            />
          </Field>
        )}
      />
      {installations.map((installation, index) => (
        <PolicySection
          {...props}
          key={installation.chainId}
          form={form}
          installationIndex={index}
          onSaveTokenSelection={(selection) =>
            onSaveTokenSelection(installation.chainId, selection)
          }
        />
      ))}
    </section>
  );
}
