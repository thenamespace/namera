// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo, useState, type FormEvent } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { type ListWalletsResponse } from "@namera-ai/protocol/dto";
import { AlertDialog, Button, Typography } from "@namera-ai/ui";
import { useForm, useWatch } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { hasPermissions } from "@/components/permission";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";
import { useCurrentUser } from "@/hooks/auth";
import { useBilling } from "@/hooks/billing";

import { ActivateSessionKey } from "./activate-key";
import { SessionKeyCreated } from "./created";
import type { CustodyLimits } from "./custody-field";
import { sessionCustodyLimits } from "./custody-limits";
import { SessionKeyDetailsCard } from "./details-card";
import { createSessionKeyInitialValues, type SessionKeyInitialOptions } from "./initial-values";
import { SessionNetworksField } from "./networks-field";
import { InstallationPolicies } from "./policies/installations";
import { RecipeCreationForm } from "./recipe-form";
import { CreateSessionKeyFormSchema } from "./schema";
import { SetupSessionKey } from "./setup-key";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";
import { useSessionKeyCreation } from "./use-session-key-creation";

type CreateSessionKeyFormProps = SessionKeyInitialOptions & {
  wallets: ListWalletsResponse;
  from?: "get-started" | undefined;
};

const unknownLimits: CustodyLimits = { local: false, managed: false };

export function CreateSessionKeyForm(props: CreateSessionKeyFormProps) {
  const user = useCurrentUser();
  return hasPermissions(user.data?.role.permissions ?? [], ["billing:read"]) ? (
    <BillingSessionKeyForm {...props} />
  ) : (
    <SessionKeyForm {...props} limits={unknownLimits} />
  );
}

function BillingSessionKeyForm(props: CreateSessionKeyFormProps) {
  const billing = useBilling();
  const limits = useMemo(
    () => sessionCustodyLimits(billing.data?.resources),
    [billing.data?.resources],
  );
  return <SessionKeyForm {...props} limits={limits} />;
}

function SessionKeyForm({
  wallets,
  initialAccountId,
  limits,
  recipe,
  onboarding,
  from,
}: CreateSessionKeyFormProps & { limits: CustodyLimits }) {
  const [initialValues] = useState(() =>
    createSessionKeyInitialValues(
      wallets,
      { initialAccountId, recipe, onboarding },
      Math.floor(Date.now() / 1000),
    ),
  );
  const navigate = useNavigate();
  const creation = useSessionKeyCreation(wallets);
  const { registration, registrationError, managedCreationFailed, setup, needsBackup, blocker } =
    creation;
  const [step, setStep] = useState<"details" | "policies">("details");
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [tokenSelections, setTokenSelections] = useState<
    ReadonlyMap<string, TokenSpendingSelection>
  >(() => new Map());
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: initialValues,
    mode: "onChange",
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const { isSubmitting } = form.formState;
  const selectedCustody = useWatch({ control: form.control, name: "custody" });
  const installations = useWatch({ control: form.control, name: "onchain.installations" });
  const limitReached = selectedCustody === "local" ? limits.local : limits.managed;
  const creationBlocker = managedCreationFailed
    ? "Creation couldn’t be confirmed. Check your session keys before trying again."
    : limitReached
      ? "Your session-key limit is reached. Go back to details to review custody options."
      : editingPolicy
        ? "Save or cancel the policy you’re editing before creating the key."
        : undefined;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creationBlocker || creation.isPending || isSubmitting || step !== "policies") return;
    void form.handleSubmit(creation.submit, (invalidFields) => {
      if (invalidFields.metadata || invalidFields.walletId || invalidFields.custody)
        setStep("details");
    })(event);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {completed && registration ? (
        <SessionKeyCreated
          sessionKey={registration}
          embedded
          onboarding={from === "get-started"}
          onEnableNetworks={() => setCompleted(false)}
        />
      ) : null}
      <div hidden={completed}>
        <HeadingGroup className="mb-6">
          <HeadingGroup.Title level={1} size="lg">
            {registration
              ? "Finish setting up your key"
              : (recipe?.display.name ?? "Create a session key")}
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            {registration
              ? "Your key is registered. Complete these steps before using it."
              : (recipe?.display.description ??
                "Define scoped access to an account for agents and integrations.")}
          </HeadingGroup.Description>
        </HeadingGroup>
        {registration ? (
          <div className="grid gap-6">
            {registrationError ? (
              <Typography.Paragraph role="alert" className="text-danger">
                The returned configuration differs from your choices. No export or approval is
                available.
              </Typography.Paragraph>
            ) : registration.signer.custody === "namera-managed" ? (
              <ActivateSessionKey
                sessionKey={registration}
                onboarding={from === "get-started"}
                onFinish={recipe ? () => setCompleted(true) : undefined}
              />
            ) : setup ? (
              <SetupSessionKey
                sessionKey={registration}
                onboarding={from === "get-started"}
                draft={setup.draft}
                bindings={setup.bindings}
                onSaved={creation.acknowledgeBackup}
                onFinish={recipe ? () => setCompleted(true) : undefined}
              />
            ) : null}
            {registrationError ? (
              <Button
                variant="tertiary"
                onPress={() =>
                  void navigate({
                    to: "/session-key/$sessionKeyId/overview",
                    params: { sessionKeyId: registration.id },
                  })
                }
              >
                Open session details
              </Button>
            ) : null}
          </div>
        ) : (
          <div>
            {managedCreationFailed ? (
              <Typography.Paragraph role="alert" className="mb-4" color="muted" size="sm">
                Creation could not be confirmed. Check the session-key list before trying again. If
                no key appears, contact support; a provider resource may still have been created.
              </Typography.Paragraph>
            ) : null}
            {recipe ? (
              <RecipeCreationForm
                recipe={recipe}
                metadataForm={form}
                wallets={wallets}
                limits={limits}
                custodyLocked={needsBackup || creation.isPending || managedCreationFailed}
                disabled={limitReached || creation.isPending || managedCreationFailed}
                onCreate={creation.submit}
              />
            ) : step === "details" ? (
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void form
                    .trigger(["metadata", "walletId", "custody"], { shouldFocus: true })
                    .then((valid) => {
                      if (valid && !limitReached && installations.length > 0) setStep("policies");
                      return valid;
                    });
                }}
                className="grid gap-6"
              >
                <section className="grid gap-4">
                  <HeadingGroup.Title size="sm">Metadata</HeadingGroup.Title>
                  <SessionKeyDetailsCard
                    form={form}
                    wallets={wallets}
                    limits={limits}
                    custodyLocked={needsBackup || creation.isPending || managedCreationFailed}
                  >
                    <SessionNetworksField form={form} />
                  </SessionKeyDetailsCard>
                </section>
                <Button
                  fullWidth
                  type="submit"
                  isDisabled={limitReached || managedCreationFailed || installations.length === 0}
                >
                  Continue
                </Button>
              </form>
            ) : (
              <>
                <InstallationPolicies
                  tokenSelections={tokenSelections}
                  onSaveTokenSelection={(chainId, selection) => {
                    const address =
                      selection.source === "catalog"
                        ? selection.deployment.address
                        : selection.value.address;
                    setTokenSelections((previous) =>
                      new Map(previous).set(`${chainId}:${address.toLowerCase()}`, selection),
                    );
                  }}
                  form={form}
                  wallets={wallets}
                  editing={editingPolicy}
                  onEditingChange={setEditingPolicy}
                />
                {creationBlocker ? (
                  <output id="create-session-key-blocker" className="mt-3 block text-sm text-muted">
                    {creationBlocker}
                  </output>
                ) : null}

                <form
                  id="create-session-key-form"
                  noValidate
                  onSubmit={handleSubmit}
                  className="mt-6 flex items-center justify-between pt-5"
                >
                  <Button
                    type="button"
                    variant="tertiary"
                    isDisabled={editingPolicy || creation.isPending}
                    onPress={() => setStep("details")}
                  >
                    Back to details
                  </Button>
                  <Button
                    className="mt-4"
                    form="create-session-key-form"
                    {...(creationBlocker
                      ? { "aria-describedby": "create-session-key-blocker" }
                      : {})}
                    isDisabled={creation.isPending || isSubmitting}
                    type="submit"
                  >
                    {creation.isPending ? "Creating…" : "Create session key"}
                  </Button>
                </form>
              </>
            )}
          </div>
        )}
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen={blocker.status === "blocked"}
            onOpenChange={(open) => {
              if (!open) blocker.reset?.();
            }}
          >
            <AlertDialog.Container size="md">
              <AlertDialog.Dialog className="rounded-xl">
                <AlertDialog.Header>
                  <AlertDialog.Heading>Leave without saving your key?</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  Your local key will be lost permanently. Pending registrations stay inactive until
                  the account owner approves them.
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button size="sm" variant="tertiary" onPress={() => blocker.reset?.()}>
                    Stay and save key
                  </Button>
                  <Button size="sm" variant="danger" onPress={() => blocker.proceed?.()}>
                    Discard local key
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </div>
    </div>
  );
}
