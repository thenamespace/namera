// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { useBlocker, useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  type CreateEvmSessionKeyRequest,
  type CreateSessionKeyResponse,
  type ListWalletsResponse,
} from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  createLocalSessionBindings,
  createLocalSessionKeyDraft,
  type LocalSessionKeyDraft,
} from "@namera-ai/sdk";
import { AlertDialog, Button, Typography } from "@namera-ai/ui";
import { useForm, useWatch, type DefaultValues } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { hasPermissions } from "@/components/permission";
import { recoverSessionRegistration } from "@/components/session-key-installations/registration-recovery";
import { useCurrentUser } from "@/hooks/auth";
import { useBilling } from "@/hooks/billing";
import { useCreateSessionKey } from "@/hooks/session-key";
import { useRecoverSessionRegistration } from "@/hooks/session-key/recover-registration";
import { supportsSessionKeys } from "@/lib/session-owner";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { ActivateSessionKey } from "./activate-key";
import type { CustodyLimits } from "./custody-field";
import { sessionCustodyLimits } from "./custody-limits";
import { SessionKeyDetailsCard } from "./details-card";
import { validateManagedRegistration } from "./managed-registration";
import { PolicySection } from "./policies";
import { CreateSessionKeyFormSchema } from "./schema";
import { SetupSessionKey } from "./setup-key";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

const defaultLogo: MetadataIcon = { type: "emoji", value: "🔑" };
const defaultValues = {
  custody: "namera-managed",
  namespace: "eip155",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
    description: "",
  },
  policies: [],
  onchain: {
    chains: ["eip155:1"],
    validAfter: 0,
    validUntil: 0,
    permissions: [],
    allowSignatures: false,
  },
} satisfies DefaultValues<CreateSessionKeyFormInput>;

type CreateSessionKeyFormProps = {
  initialAccountId?: string | undefined;
  wallets: ListWalletsResponse;
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
}: CreateSessionKeyFormProps & { limits: CustodyLimits }) {
  const [initialValues] = useState(() => ({
    ...defaultValues,
    walletId:
      wallets.find((wallet) => wallet.id === initialAccountId && supportsSessionKeys(wallet))?.id ??
      "",
    onchain: {
      ...defaultValues.onchain,
      validUntil: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
  }));
  const navigate = useNavigate();
  const draft = useRef<LocalSessionKeyDraft | null>(null);
  const submitting = useRef(false);
  const reviewedWallet = useRef<ListWalletsResponse[number] | undefined>(undefined);
  const mounted = useRef(true);
  const recoveryAbort = useRef<AbortController | null>(null);
  const recover = useRecoverSessionRegistration();
  const [needsBackup, setNeedsBackup] = useState(false);
  const [registration, setRegistration] = useState<CreateSessionKeyResponse>();
  const [setup, setSetup] = useState<{
    draft: LocalSessionKeyDraft;
    bindings: ReadonlyArray<LocalEvmSessionBinding>;
  }>();
  const [registrationError, setRegistrationError] = useState(false);
  const [managedCreationFailed, setManagedCreationFailed] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recoveryAbort.current?.abort();
      draft.current?.dispose();
      draft.current = null;
    };
  }, []);
  const blocker = useBlocker({
    shouldBlockFn: () => needsBackup,
    enableBeforeUnload: needsBackup,
    withResolver: true,
  });
  const acceptRegistration = (
    created: CreateSessionKeyResponse,
    payload: CreateEvmSessionKeyRequest,
  ) => {
    if (!mounted.current) return;
    setRegistration(created);
    const wallet = reviewedWallet.current;
    try {
      if (!wallet) throw new Error("Selected wallet unavailable");
      if (payload.signer.custody === "namera-managed") {
        validateManagedRegistration(payload, wallet, created);
        showSuccessToast({
          title: "Session key registered",
          description: "Approve network access before using it.",
        });
        return;
      }
      if (!draft.current) throw new Error("Local session key unavailable");
      setSetup({
        draft: draft.current,
        bindings: createLocalSessionBindings({ request: payload, wallet, registration: created }),
      });
    } catch (error) {
      setRegistrationError(true);
      showErrorToast(error, {
        title: "Session configuration does not match",
        description: "Do not approve this session. Keep this page open.",
      });
      return;
    }
    showSuccessToast({
      title: "Session key registered",
      description: "Save your key. Onchain approval is still required.",
    });
  };
  const createSessionKey = useCreateSessionKey({
    onSettled: () => {
      submitting.current = false;
    },
    onError: async (error, { payload }) => {
      if (!mounted.current) return;
      if (payload.signer.custody === "namera-managed") {
        setManagedCreationFailed(true);
        showErrorToast(error, {
          title: "Couldn’t confirm session creation",
          description: "Check your session keys before creating another managed key.",
        });
        return;
      }
      const abort = new AbortController();
      recoveryAbort.current = abort;
      try {
        const wallet = reviewedWallet.current;
        if (!wallet) throw new Error("Selected wallet unavailable");
        const sessions = await recover(payload.walletId, abort.signal);
        if (abort.signal.aborted) return;
        const recovered = recoverSessionRegistration(payload, wallet, sessions);
        if (recovered) {
          acceptRegistration(recovered, payload);
          return;
        }
      } catch (recoveryError) {
        if (abort.signal.aborted) return;
        showErrorToast(recoveryError, {
          title: "Couldn’t recover registration",
          description: "Keep this page open and retry with the same local key.",
        });
        return;
      }
      showErrorToast(error, {
        title: "Couldn’t create session key",
        description: "Review its details and policies, then try again.",
      });
    },
    onSuccess: (created, { payload }) => acceptRegistration(created, payload),
  });
  const form = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: initialValues,
    mode: "onChange",
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const selectedCustody = useWatch({ control: form.control, name: "custody" });
  const limitReached = selectedCustody === "local" ? limits.local : limits.managed;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      submitting.current ||
      createSessionKey.isPending ||
      registration ||
      managedCreationFailed ||
      limitReached ||
      !form.formState.isValid
    )
      return;
    submitting.current = true;
    try {
      if (form.getValues("custody") === "local") {
        draft.current ??= createLocalSessionKeyDraft();
        setNeedsBackup(true);
      }
    } catch (error) {
      submitting.current = false;
      showErrorToast(error, {
        title: "Couldn’t generate session key",
        description: "Use a supported browser with secure randomness.",
      });
      return;
    }
    void form
      .handleSubmit(
        ({ custody, ...payload }) => {
          reviewedWallet.current = wallets.find((wallet) => wallet.id === payload.walletId);
          if (custody === "namera-managed") {
            createSessionKey.mutate({
              payload: {
                ...payload,
                signer: { custody, provider: "1claw", algorithm: "secp256k1" },
              },
            });
            return;
          }
          if (!draft.current) {
            submitting.current = false;
            return;
          }
          createSessionKey.mutate({ payload: { ...payload, signer: draft.current.signer } });
        },
        () => {
          submitting.current = false;
        },
      )(event)
      .catch((error) => {
        submitting.current = false;
        showErrorToast(error, {
          title: "Couldn’t validate session key",
          description: "Review the form and try again.",
        });
      });
  };

  return (
    <>
      <HeadingGroup className="mb-6">
        <HeadingGroup.Title level={1} size="lg">
          {registration ? "Finish setting up your key" : "Create a session key"}
        </HeadingGroup.Title>
        <HeadingGroup.Description>
          {registration
            ? "Your key is registered. Complete these steps before using it."
            : "Define scoped access to an account for agents and integrations."}
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
            <ActivateSessionKey sessionKey={registration} />
          ) : setup ? (
            <SetupSessionKey
              sessionKey={registration}
              draft={setup.draft}
              bindings={setup.bindings}
              onSaved={() => {
                setNeedsBackup(false);
                draft.current?.dispose();
              }}
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
        <form id="create-session-key-form" noValidate onSubmit={handleSubmit}>
          {managedCreationFailed ? (
            <Typography.Paragraph role="alert" className="mb-4" color="muted" size="sm">
              Creation could not be confirmed. Check the session-key list before trying again. If no
              key appears, contact support; a provider resource may still have been created.
            </Typography.Paragraph>
          ) : null}
          <div className="grid gap-8">
            <section className="grid gap-4">
              <HeadingGroup.Title size="sm">Metadata</HeadingGroup.Title>
              <SessionKeyDetailsCard
                control={form.control}
                wallets={wallets}
                limits={limits}
                custodyLocked={needsBackup || createSessionKey.isPending || managedCreationFailed}
              />
            </section>
            <PolicySection form={form} wallets={wallets} />
          </div>
          {form.formState.isSubmitted && Object.keys(form.formState.errors).length > 0 ? (
            <Typography.Paragraph role="alert" className="mt-3 text-danger" size="sm">
              Review the account, lifetime and permission fields before continuing.
            </Typography.Paragraph>
          ) : null}

          <Button
            className="mt-4"
            form="create-session-key-form"
            fullWidth
            isDisabled={
              managedCreationFailed ||
              limitReached ||
              createSessionKey.isPending ||
              form.formState.isSubmitting ||
              !form.formState.isValid
            }
            type="submit"
          >
            {createSessionKey.isPending ? "Creating…" : "Create session key"}
          </Button>
        </form>
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
    </>
  );
}
