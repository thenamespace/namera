// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useState } from "react";

import { Field, FieldLabel, FieldError } from "@namera-ai/ui";
import { Controller, type UseFormReturn } from "react-hook-form";

import { DashboardCardRow } from "@/components/dashboard-card";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";

import { selectInstallationNetworks } from "./policies/installation-selection";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export function SessionNetworksField({
  form,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
}) {
  const [removalError, setRemovalError] = useState<string>();
  return (
    <Controller
      control={form.control}
      name="onchain.installations"
      render={({ field }) => (
        <DashboardCardRow className="items-start sm:items-start">
          <Field className="contents" data-invalid={Boolean(removalError) || !field.value.length}>
            <FieldLabel id="session-networks-label" isRequired>
              Networks
            </FieldLabel>
            <div className="grid min-w-0 gap-2">
              <EvmNetworkMultiSelect
                aria-labelledby="session-networks-label"
                operationalOnly
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
                  const installations = selectInstallationNetworks(
                    form.getValues("onchain.installations"),
                    chainIds,
                    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                  );
                  field.onChange(installations);
                  if (!installations.some(({ allowSignatures }) => allowSignatures)) {
                    form.setValue("policies", [], { shouldDirty: true });
                  }
                }}
              />
              {removalError ? <FieldError>{removalError}</FieldError> : null}
              {!field.value.length ? <FieldError>Choose at least one network.</FieldError> : null}
            </div>
          </Field>
        </DashboardCardRow>
      )}
    />
  );
}
