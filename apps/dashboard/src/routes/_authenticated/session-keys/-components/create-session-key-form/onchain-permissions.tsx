// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Button, Field, FieldError, Typography } from "@namera-ai/ui";
import { Controller, useFieldArray, type UseFormReturn } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { OnchainPermissionDialog, onchainPermissionCatalog } from "@/components/policy/evm/onchain";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export function OnchainPermissions({
  form,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
}) {
  const permissionFields = useFieldArray({ control: form.control, name: "onchain.permissions" });
  return (
    <Controller
      control={form.control}
      name="onchain.permissions"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="mb-2 flex items-start justify-between gap-4">
            <HeadingGroup>
              <HeadingGroup.Title>Onchain permissions</HeadingGroup.Title>
              <HeadingGroup.Description>
                Access grants are additive. Spend limits restrict those grants on each network.
              </HeadingGroup.Description>
            </HeadingGroup>
            <OnchainPermissionDialog onAdd={(permission) => permissionFields.append(permission)} />
          </div>
          {(field.value ?? []).map((permission, index) => (
            <DashboardCardRoot key={permissionFields.fields[index]?.id}>
              <DashboardCardContent className="flex items-start justify-between gap-4 p-4">
                <div className="grid min-w-0 gap-1">
                  <Typography.Paragraph size="sm">
                    {onchainPermissionCatalog[permission.type].name}
                  </Typography.Paragraph>
                  {"address" in permission ? (
                    <span className="text-muted break-all font-mono text-xs">
                      {permission.address}
                    </span>
                  ) : null}
                  {"functions" in permission ? (
                    <span className="text-muted break-all font-mono text-xs">
                      {permission.functions.join(", ")}
                    </span>
                  ) : null}
                  {"allowance" in permission ? (
                    <span className="text-muted text-xs">
                      {permission.allowance} base units per network
                    </span>
                  ) : null}
                  {"limit" in permission ? (
                    <span className="text-muted text-xs">{permission.limit} wei per network</span>
                  ) : null}
                  {permission.type === "root" ? (
                    <span className="text-danger text-xs">
                      Full account authority, including permission management.
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  aria-label={`Remove ${onchainPermissionCatalog[permission.type].name}`}
                  onPress={() => permissionFields.remove(index)}
                >
                  Remove
                </Button>
              </DashboardCardContent>
            </DashboardCardRoot>
          ))}
          {!field.value?.length ? (
            <Typography.Paragraph size="sm" color="muted">
              Add at least one permission. A spend limit alone does not grant access to a target.
            </Typography.Paragraph>
          ) : null}
          {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}
