// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useBlocker, useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { type CreateSessionKeyResponse, type ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  createLocalSessionBindings,
  createLocalSessionKeyDraft,
  type LocalSessionKeyDraft,
} from "@namera-ai/sdk";
import { AlertDialog, Button, Typography } from "@namera-ai/ui";
import { useForm, type DefaultValues } from "react-hook-form";

import { SessionKeyInstallations } from "@/components/session-key-installations";
import { recoverSessionRegistration } from "@/components/session-key-installations/registration-recovery";
import { useCreateSessionKey } from "@/hooks/session-key";
import { useRecoverSessionRegistration } from "@/hooks/session-key/recover-registration";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { SessionKeyDetailsCard } from "./details-card";
import { ExportSessionKey } from "./export-key";
import { OnchainPermissions } from "./onchain-permissions";
import { OnchainSettings } from "./onchain-settings";
import { PolicySection } from "./policies";
import { CreateSessionKeyFormSchema } from "./schema";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

const defaultLogo: MetadataIcon = { type: "emoji", value: "🔑" };
const defaultValues = {
  namespace: "eip155",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
    description: "",
  },
  policies: [],
  onchain: {
    chains: [],
    validAfter: 0,
    validUntil: 0,
    permissions: [],
    allowSignatures: false,
  },
} satisfies DefaultValues<CreateSessionKeyFormInput>;

type CreateSessionKeyFormProps = {
  wallets: ListWalletsResponse;
};

export function CreateSessionKeyForm({ wallets }: CreateSessionKeyFormProps) {
  const navigate = useNavigate();
  const draft = useRef<LocalSessionKeyDraft | null>(null);
  const submitting = useRef(false);
  const reviewedWallet = useRef<ListWalletsResponse[number] | undefined>(undefined);
  const mounted = useRef(true);
  const recoveryAbort = useRef<AbortController | null>(null);
  const recover = useRecoverSessionRegistration();
  const [needsBackup, setNeedsBackup] = useState(false);
  const [registration, setRegistration] = useState<CreateSessionKeyResponse>();
  const [bindings, setBindings] = useState<ReadonlyArray<LocalEvmSessionBinding>>();
  const [registrationError, setRegistrationError] = useState(false);
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
    payload: CreateSessionKeyFormValues,
  ) => {
    if (!mounted.current) return;
    setRegistration(created);
    const wallet = reviewedWallet.current;
    try {
      if (!wallet) throw new Error("Selected wallet unavailable");
      setBindings(createLocalSessionBindings({ request: payload, wallet, registration: created }));
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
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || createSessionKey.isPending || registration) return;
    submitting.current = true;
    try {
      draft.current ??= createLocalSessionKeyDraft();
      setNeedsBackup(true);
      form.setValue("signer", draft.current.signer);
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
        (payload) => {
          reviewedWallet.current = wallets.find((wallet) => wallet.id === payload.walletId);
          createSessionKey.mutate({ payload });
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
      {registration ? (
        <div className="grid gap-6">
          <Typography.Paragraph color="muted" size="sm">
            Save your local key, then approve each network with the account owner’s passkey.
          </Typography.Paragraph>
          {registrationError ? (
            <Typography.Paragraph role="alert" className="text-danger">
              The returned configuration differs from your choices. No export or approval is
              available.
            </Typography.Paragraph>
          ) : bindings && draft.current ? (
            <ExportSessionKey
              draft={draft.current}
              bindings={bindings}
              onSaved={() => {
                setNeedsBackup(false);
                draft.current?.dispose();
              }}
            />
          ) : null}
          <Button
            variant="tertiary"
            onPress={() =>
              void navigate({
                to: "/session-key/$sessionKeyId/overview",
                params: { sessionKeyId: registration.id },
              })
            }
          >
            View session
          </Button>
          {!registrationError && !needsBackup ? (
            <SessionKeyInstallations key={registration.id} sessionKey={registration} />
          ) : null}
        </div>
      ) : (
        <form id="create-session-key-form" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-8">
            <SessionKeyDetailsCard control={form.control} wallets={wallets} />
            <OnchainSettings form={form} />
            <OnchainPermissions form={form} />
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
            isDisabled={createSessionKey.isPending}
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
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>Leave without saving your key?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                The local key will be lost. Namera cannot recover it. Any pending registration will
                remain, but it will not activate without your passkey approval.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => blocker.reset?.()}>
                  Keep editing
                </Button>
                <Button variant="danger" onPress={() => blocker.proceed?.()}>
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
