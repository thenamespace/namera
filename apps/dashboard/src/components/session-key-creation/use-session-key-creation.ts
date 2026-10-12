import { useEffect, useRef, useState } from "react";

import { useBlocker } from "@tanstack/react-router";

import type {
  CreateEvmSessionKeyRequest,
  CreateSessionKeyResponse,
  ListWalletsResponse,
} from "@namera-ai/protocol/dto";
import type { LocalEvmSessionBinding } from "@namera-ai/protocol/local";
import {
  createLocalSessionBindings,
  createLocalSessionKeyDraft,
  type LocalSessionKeyDraft,
} from "@namera-ai/sdk";

import { recoverSessionRegistration } from "@/components/session-key-installations/registration-recovery";
import { useCreateSessionKey } from "@/hooks/session-key";
import { useRecoverSessionRegistration } from "@/hooks/session-key/recover-registration";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { validateManagedRegistration } from "./managed-registration";
import type { CreateSessionKeyFormValues } from "./types";

export function useSessionKeyCreation(wallets: ListWalletsResponse) {
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

  const submit = ({ custody, ...payload }: CreateSessionKeyFormValues) => {
    if (submitting.current || createSessionKey.isPending || registration || managedCreationFailed)
      return;
    submitting.current = true;
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
    try {
      draft.current ??= createLocalSessionKeyDraft();
      setNeedsBackup(true);
    } catch (error) {
      submitting.current = false;
      showErrorToast(error, {
        title: "Couldn’t generate session key",
        description: "Use a supported browser with secure randomness.",
      });
      return;
    }
    createSessionKey.mutate({ payload: { ...payload, signer: draft.current.signer } });
  };

  const acknowledgeBackup = () => {
    setNeedsBackup(false);
    draft.current?.dispose();
  };

  return {
    submit,
    registration,
    registrationError,
    managedCreationFailed,
    setup,
    needsBackup,
    blocker,
    acknowledgeBackup,
    isPending: createSessionKey.isPending,
  };
}
