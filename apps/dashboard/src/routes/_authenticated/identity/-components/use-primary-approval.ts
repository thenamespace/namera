import { useEffect, useRef, useState } from "react";

import { DateTime, Effect, Predicate } from "effect";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import { EthereumAddress, Hex, type EnsLabel } from "@namera-ai/protocol";
import type {
  CompleteWalletTransactionRequest,
  GetWalletPasskeyOwnerResponse,
  EvmNativePriceQuote,
  PrepareWalletTransactionResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { startAuthentication } from "@simplewebauthn/browser";
import { createPublicClient, http } from "viem";

import { env } from "@/env";
import {
  useCompleteWalletTransaction,
  useCancelWalletTransaction,
  usePrepareWalletTransaction,
} from "@/hooks/wallet/transaction";
import { isOneClawAccount } from "@/lib/session-owner";
import { showErrorToast } from "@/lib/toasts";

export function usePrimaryApproval(
  wallet: WalletResponse,
  label: EnsLabel,
  descriptor: GetWalletPasskeyOwnerResponse | undefined,
  refresh: () => void,
  terminalOperationId: string | undefined,
) {
  const prepare = usePrepareWalletTransaction();
  const approve = useCompleteWalletTransaction();
  const cancel = useCancelWalletTransaction();
  const [progress, setProgress] = useState<
    "Preparing…" | "Reviewing…" | "Signing…" | "Submitting…" | "Cancelling…" | null
  >(null);
  const [reviewFee, setReviewFee] = useState<bigint>();
  const [sponsored, setSponsored] = useState(false);
  const [reviewContract, setReviewContract] = useState<`0x${string}`>();
  const [priceQuote, setPriceQuote] = useState<EvmNativePriceQuote | null>(null);
  const confirm = useRef<((accepted: boolean) => void) | undefined>(undefined);
  const attempt = useRef<
    | {
        key: string;
        sponsor?: boolean;
        prepared?: PrepareWalletTransactionResponse;
        assertion?: CompleteWalletTransactionRequest;
      }
    | undefined
  >(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const busy = useRef(false);
  useEffect(() => {
    if (terminalOperationId && attempt.current?.prepared?.operationId === terminalOperationId)
      attempt.current = undefined;
  }, [terminalOperationId]);
  useEffect(
    () => () => {
      abort.current?.abort();
      confirm.current?.(false);
    },
    [],
  );
  const answer = (accepted: boolean) => {
    setReviewFee(undefined);
    confirm.current?.(accepted);
    confirm.current = undefined;
  };
  const start = async (retryKey: string | null, sponsor = true) => {
    if (busy.current) return;
    busy.current = true;
    setProgress("Preparing…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const managed = isOneClawAccount(wallet);
      const owner = descriptor?.owner;
      if (
        !managed &&
        (!owner ||
          descriptor?.walletId !== wallet.id ||
          owner.signingKeyId !== wallet.owner.signingKeyId)
      )
        throw new Error("Passkey owner unavailable");
      const current = (attempt.current ??= { key: retryKey ?? crypto.randomUUID(), sponsor });
      if (!current.assertion) {
        const chain = getChainDataByCaip2("eip155:1");
        if (!chain) throw new Error("Ethereum unavailable");
        const { reviewPrimaryName, validatePrimaryApproval } =
          await import("@namera-ai/evm/identity-review");
        const reviewed = await reviewPrimaryName(
          {
            wallet: {
              ...wallet.data,
              address: wallet.address,
              implementation: wallet.implementation,
            },
            name: `${label}.namera.id`,
            ...(!managed && owner
              ? {
                  owner: {
                    publicKey: owner.publicKeyHex,
                    credentialId: owner.credentialId,
                    rpId: owner.rpId,
                  },
                }
              : {}),
          },
          createPublicClient({
            chain: chain.chain,
            transport: http(`${env.backendUrl}/rpc/eip155/1`),
          }),
        );
        if (controller.signal.aborted) return;
        const prepareRequest = () =>
          prepare.mutateAsync({
            params: { walletId: wallet.id },
            headers: { "idempotency-key": current.key },
            payload: {
              namespace: "eip155",
              chainId: "eip155:1",
              calls: [
                {
                  to: EthereumAddress.make(reviewed.call.to),
                  value: reviewed.call.value,
                  data: Hex.make(reviewed.call.data),
                },
              ],
              sponsor: current.sponsor ?? true,
            },
          });
        if (!current.prepared) {
          try {
            current.prepared = await prepareRequest();
          } catch (error) {
            if (
              !(
                Predicate.isTagged(error, "BillingError") &&
                "limit" in error &&
                error.limit === "gas-sponsorship"
              ) ||
              current.sponsor === false
            )
              throw error;
            current.key = crypto.randomUUID();
            current.sponsor = false;
            current.prepared = await prepareRequest();
          }
        }
        if (controller.signal.aborted) return;
        const response = current.prepared;
        const operation = response.prepared.userOperation;
        const fee =
          (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
          operation.maxFeePerGas;
        validatePrimaryApproval(reviewed, response, fee, Effect.runSync(DateTime.now));
        const accepted = await new Promise<boolean>((resolve) => {
          setProgress("Reviewing…");
          confirm.current = resolve;
          setReviewContract(reviewed.call.to);
          setPriceQuote(response.priceQuote ?? null);
          const estimate = response.prepared.context.simulation.userOperation;
          setReviewFee(
            (estimate.callGasLimit + estimate.verificationGasLimit + estimate.preVerificationGas) *
              estimate.maxFeePerGas,
          );
          setSponsored(response.prepared.sponsorship === "alchemy-bso");
        });
        if (controller.signal.aborted) return;
        if (!accepted) {
          setProgress("Cancelling…");
          await cancel.mutateAsync({
            params: { walletId: wallet.id, operationId: response.operationId },
          });
          attempt.current = undefined;
          return;
        }
        validatePrimaryApproval(reviewed, response, fee, Effect.runSync(DateTime.now));
        if (response.signing.method === "passkey") {
          setProgress("Signing…");
          const assertion = await startAuthentication({
            optionsJSON: {
              ...response.signing.options,
              allowCredentials: response.signing.options.allowCredentials.map(({ id, type }) => ({
                id,
                type,
              })),
            },
          });
          if (controller.signal.aborted) return;
          current.assertion = {
            namespace: "eip155",
            operationId: response.operationId,
            response: assertion,
          };
        } else current.assertion = { namespace: "eip155", operationId: response.operationId };
      }
      setProgress("Submitting…");
      await approve.mutateAsync({
        params: { walletId: wallet.id },
        payload: current.assertion,
      });
      attempt.current = undefined;
    } catch (error) {
      if (!controller.signal.aborted) {
        // Expired, unsigned preparations need a new key. Signed retries retain the exact assertion.
        const current = attempt.current;
        if (
          current?.prepared &&
          !current.assertion &&
          DateTime.toEpochMillis(current.prepared.expiresAt) <= Date.now()
        )
          attempt.current = undefined;
        showErrorToast(error, {
          title: "Couldn’t set primary name",
          description: "Retry to resume your approval safely.",
        });
      }
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) {
        setProgress(null);
        refresh();
      }
    }
  };
  return {
    start,
    pending: progress !== null,
    progress,
    reviewFee,
    reviewContract,
    priceQuote,
    sponsored,
    answer,
  };
}
