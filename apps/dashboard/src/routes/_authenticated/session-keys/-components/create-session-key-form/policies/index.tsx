// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useMemo, useState } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import { FieldError, Typography } from "@namera-ai/ui";
import { ShieldUserIcon } from "@namera-ai/ui/icons";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { EvmAddressDisplay } from "@/components/display/evm-address-display";
import { HeadingGroup } from "@/components/heading-group";
import { evmPolicyDefinitions, EvmPolicySummary } from "@/components/policy/evm";
import { onchainPermissionCatalog } from "@/components/policy/evm/onchain/catalog";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { SessionPolicyCard } from "./card";
import { AddPolicyButton, SessionPolicyDialog, type PolicyEdit } from "./dialog";
import { toOnchainLifetime, toTimeWindowPolicy } from "./lifetime";

export function PolicySection({
  form,
  wallets,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
}) {
  const apiFields = useFieldArray({ control: form.control, name: "policies" });
  const permissionFields = useFieldArray({ control: form.control, name: "onchain.permissions" });
  const policies = useWatch({ control: form.control, name: "policies" }) ?? [];
  const onchain = useWatch({ control: form.control, name: "onchain" });
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const [dialog, setDialog] = useState<{ edit?: PolicyEdit } | null>(null);
  const permissions = onchain?.permissions ?? [];
  const validAfter = onchain?.validAfter ?? 0;
  const validUntil = onchain?.validUntil ?? 0;
  const lifetime = useMemo(
    () => toTimeWindowPolicy(validAfter, validUntil),
    [validAfter, validUntil],
  );
  const errors = form.formState.errors.onchain;

  return (
    <section className="grid gap-3">
      <div className="mb-1 flex items-start justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title>Policies</HeadingGroup.Title>
        </HeadingGroup>
        <AddPolicyButton
          disabled={!wallets.some((wallet) => wallet.id === walletId)}
          onPress={() => setDialog({})}
        />
      </div>
      {onchain?.allowSignatures ? (
        <SessionPolicyCard
          name="Signatures"
          icon={evmPolicyDefinitions["evm.signature"].icon}
          enforcement="onchain"
          onRemove={() =>
            form.setValue("onchain.allowSignatures", false, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          Messages and typed data
        </SessionPolicyCard>
      ) : null}
      {permissionFields.fields.map((field, index) => {
        const permission = permissions[index];
        if (!permission) return null;
        const definition = onchainPermissionCatalog[permission.type];
        const icon =
          permission.type === "native-token-transfer"
            ? evmPolicyDefinitions["evm.native-spend-limit"].icon
            : permission.type === "gas-limit"
              ? evmPolicyDefinitions["evm.gas-budget"].icon
              : ShieldUserIcon;
        return (
          <SessionPolicyCard
            key={field.id}
            name={definition.name}
            icon={icon}
            enforcement="onchain"
            onEdit={() =>
              setDialog({ edit: { enforcement: "onchain", policy: permission, index } })
            }
            onRemove={() => permissionFields.remove(index)}
          >
            <span className="grid gap-1">
              {"address" in permission ? (
                <EvmAddressDisplay address={EthereumAddress.make(permission.address)} />
              ) : null}
              {"functions" in permission ? (
                <span className="break-all font-mono text-xs">
                  {permission.functions.join(", ")}
                </span>
              ) : null}
              {"allowance" in permission ? (
                <span>{permission.allowance} base units · Lifetime per network</span>
              ) : null}
              {"limit" in permission ? (
                <span>{permission.limit} wei · Lifetime per network</span>
              ) : null}
              {permission.type === "root" ? (
                <span className="text-danger">
                  Full account authority, including permission management
                </span>
              ) : null}
            </span>
          </SessionPolicyCard>
        );
      })}
      <FieldError errors={[errors?.permissions, errors?.permissions?.root]} />
      {policies.map((policy, index) => (
        <SessionPolicyCard
          key={apiFields.fields[index]?.id ?? policy.type}
          name={evmPolicyDefinitions[policy.type].name}
          icon={evmPolicyDefinitions[policy.type].icon}
          enforcement="offchain"
          onEdit={() => setDialog({ edit: { enforcement: "offchain", policy, index } })}
          onRemove={() => apiFields.remove(index)}
        >
          <EvmPolicySummary policy={policy} />
        </SessionPolicyCard>
      ))}
      {!permissions.length ? (
        <Typography.Paragraph size="xs" color="muted">
          Add an onchain access policy to allow transactions.
        </Typography.Paragraph>
      ) : null}
      {dialog ? (
        <SessionPolicyDialog
          open
          edit={dialog.edit}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          apiTypes={policies.map((policy) => policy.type)}
          permissions={permissions}
          allowSignatures={onchain?.allowSignatures ?? false}
          lifetime={lifetime}
          onSaveApi={(policy, index) =>
            index === undefined ? apiFields.append(policy) : apiFields.update(index, policy)
          }
          onSavePermission={(permission, index) =>
            index === undefined
              ? permissionFields.append(permission)
              : permissionFields.update(index, permission)
          }
          onSaveLifetime={(policy) => {
            const next = toOnchainLifetime(policy);
            form.setValue("onchain.validAfter", next.validAfter, {
              shouldDirty: true,
              shouldValidate: true,
            });
            form.setValue("onchain.validUntil", next.validUntil, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
          onEnableSignatures={() =>
            form.setValue("onchain.allowSignatures", true, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      ) : null}
    </section>
  );
}
