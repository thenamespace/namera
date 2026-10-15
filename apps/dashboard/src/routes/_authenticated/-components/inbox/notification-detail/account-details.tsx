import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import { evmPolicyDisplayNames } from "@namera-ai/protocol";
import { buttonVariants } from "@namera-ai/ui";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import {
  ChainDisplay,
  EvmAddressDisplay,
  NamespaceDisplay,
  WalletImplementationDisplay,
  WalletOwnerDisplay,
} from "@/components/display";

import { SessionNotificationCustody } from "../session-custody";
import {
  DetailList,
  DetailRow,
  InternalAction,
  NotificationDetailActions,
  NotificationDetailLayout,
  ResourceId,
  type NotificationOf,
} from "./layout";

export function WalletCreatedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"wallet.created">;
}) {
  return (
    <NotificationDetailLayout
      description="Your smart account was created successfully and is ready for session key setup."
      item={item}
    >
      <DetailList>
        <DetailRow label="Namespace">
          <NamespaceDisplay namespace="eip155" />
        </DetailRow>
        <DetailRow label="Address">
          <EvmAddressDisplay address={item.notification.data.address} />
        </DetailRow>
        <DetailRow label="Implementation">
          <WalletImplementationDisplay implementation={item.notification.data.implementation} />
        </DetailRow>
        <DetailRow label="Ownership">
          <WalletOwnerDisplay
            custody={item.notification.data.custody}
            provider={
              "provider" in item.notification.data ? item.notification.data.provider : undefined
            }
            protectionLevel={
              item.notification.data.custody === "namera-managed"
                ? item.notification.data.protectionLevel
                : undefined
            }
          />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="accountId"
          paramValue={item.notification.resourceId}
          to="/account/$accountId/overview"
        >
          Open account
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

function SessionKeyNotificationDetail({
  item,
  revoked,
}: {
  readonly item: NotificationOf<"session_key.created"> | NotificationOf<"session_key.revoked">;
  readonly revoked: boolean;
}) {
  return (
    <NotificationDetailLayout
      description={
        revoked
          ? "Access for this session key was revoked, including its active grants. Open the session key to review its network status."
          : "A session key was registered. Its onchain permissions require account-owner approval before use. Additional API policies apply to operations sent through Namera."
      }
      item={item}
    >
      <DetailList>
        <DetailRow label="Custody">
          <SessionNotificationCustody notification={item.notification} />
        </DetailRow>
        {item.notification.type === "session_key.created" ? (
          <DetailRow label="Policies">
            <div className="flex flex-wrap gap-1.5">
              {item.notification.data.policyTypes.map((policy) => (
                <span className="rounded-md bg-tertiary px-2 py-1 text-xs" key={policy}>
                  {evmPolicyDisplayNames[policy]}
                </span>
              ))}
            </div>
          </DetailRow>
        ) : (
          <DetailRow label="Revoked grants">
            <span className="tabular-nums">{item.notification.data.revokedGrantCount}</span>
          </DetailRow>
        )}
        <DetailRow label="Session key ID">
          <ResourceId label="Session key ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="sessionKeyId"
          paramValue={item.notification.resourceId}
          to="/session-key/$sessionKeyId/overview"
        >
          Open session key
        </InternalAction>
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}

export function SessionKeyCreatedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"session_key.created">;
}) {
  return <SessionKeyNotificationDetail item={item} revoked={false} />;
}

export function SessionKeyRevokedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"session_key.revoked">;
}) {
  return <SessionKeyNotificationDetail item={item} revoked />;
}

export function ExecutionConfirmedNotificationDetail({
  item,
}: {
  readonly item: NotificationOf<"execution.confirmed">;
}) {
  const explorerUrl = getChainDataByCaip2(item.notification.data.chainId)?.chain.blockExplorers
    ?.default.url;
  const transactionUrl = explorerUrl
    ? `${explorerUrl.replace(/\/$/, "")}/tx/${item.notification.data.transactionHash}`
    : undefined;
  return (
    <NotificationDetailLayout
      description="The account operation was included onchain. Its confirmed transaction and execution record are available below."
      item={item}
    >
      <DetailList>
        <DetailRow label="Network">
          <ChainDisplay chainId={item.notification.data.chainId} />
        </DetailRow>
        <DetailRow label="Transaction hash">
          <ResourceId label="Transaction hash" value={item.notification.data.transactionHash} />
        </DetailRow>
        <DetailRow label="Execution ID">
          <ResourceId label="Execution ID" value={item.notification.resourceId} />
        </DetailRow>
      </DetailList>
      <NotificationDetailActions>
        <InternalAction
          paramName="executionId"
          paramValue={item.notification.resourceId}
          to="/execution/$executionId"
        >
          View execution
        </InternalAction>
        {transactionUrl === undefined ? null : (
          <a
            className={buttonVariants({ size: "sm", variant: "tertiary" })}
            href={transactionUrl}
            rel="noreferrer"
            target="_blank"
          >
            View on explorer
            <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
          </a>
        )}
      </NotificationDetailActions>
    </NotificationDetailLayout>
  );
}
