// Drizzle rows are untrusted persistence values and are decoded before leaving
// the repository boundary.
// oxlint-disable typescript/no-explicit-any
import { Schema, type DateTime } from "effect";

import { ExecutionId, SessionKeyId, WalletId } from "@namera-ai/protocol";
import { EthereumAddress, SupportedEvmChainId, TransactionHash } from "@namera-ai/protocol/evm";
import {
  Actor,
  ActorType,
  Execution,
  SessionKey,
  SessionKeyMetadata,
  Wallet,
  WalletMetadata,
  WalletKey,
  type Actor as ActorModel,
  type Execution as ExecutionModel,
  type SessionKey as SessionKeyModel,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";

import { actor, execution, sessionKey, wallet } from "#/schema/index";

import type { WalletView } from "./wallet.js";

export interface ExecutionListView {
  readonly details: {
    readonly id: typeof ExecutionId.Type;
    readonly namespace: "eip155";
    readonly chainId: typeof SupportedEvmChainId.Type;
    readonly transactionHash: typeof TransactionHash.Type;
    readonly createdAt: DateTime.Utc;
  };
  readonly wallet: {
    readonly id: typeof WalletId.Type;
    readonly namespace: "eip155";
    readonly address: typeof EthereumAddress.Type;
    readonly metadata: typeof WalletMetadata.Type;
  };
  readonly sessionKey: {
    readonly id: typeof SessionKeyId.Type;
    readonly namespace: "eip155";
    readonly metadata: typeof SessionKeyMetadata.Type;
  };
  readonly actorType: typeof ActorType.Type;
}

export const decodeExecutionListView = (row: {
  readonly executionId: unknown;
  readonly executionNamespace: unknown;
  readonly chainId: unknown;
  readonly transactionHash: unknown;
  readonly executionCreatedAt: unknown;
  readonly walletId: unknown;
  readonly walletNamespace: unknown;
  readonly walletAddress: unknown;
  readonly walletMetadata: unknown;
  readonly sessionKeyId: unknown;
  readonly sessionKeyNamespace: unknown;
  readonly sessionKeyMetadata: unknown;
  readonly actorType: unknown;
}): ExecutionListView => ({
  details: {
    id: Schema.decodeSync(ExecutionId)(row.executionId as any),
    namespace: Schema.decodeSync(Schema.Literal("eip155"))(row.executionNamespace as any),
    chainId: Schema.decodeSync(SupportedEvmChainId)(row.chainId as any),
    transactionHash: Schema.decodeSync(TransactionHash)(row.transactionHash as any),
    createdAt: Schema.decodeSync(Schema.DateTimeUtcFromDate)(row.executionCreatedAt as any),
  },
  wallet: {
    id: Schema.decodeSync(WalletId)(row.walletId as any),
    namespace: Schema.decodeSync(Schema.Literal("eip155"))(row.walletNamespace as any),
    address: Schema.decodeSync(EthereumAddress)(row.walletAddress as any),
    metadata: Schema.decodeSync(WalletMetadata)(row.walletMetadata as any),
  },
  sessionKey: {
    id: Schema.decodeSync(SessionKeyId)(row.sessionKeyId as any),
    namespace: Schema.decodeSync(Schema.Literal("eip155"))(row.sessionKeyNamespace as any),
    metadata: Schema.decodeSync(SessionKeyMetadata)(row.sessionKeyMetadata as any),
  },
  actorType: Schema.decodeSync(ActorType)(row.actorType as any),
});

export interface ExecutionDetailsView {
  readonly execution: ExecutionModel;
  readonly actor: ActorModel;
  readonly sessionKey: SessionKeyModel;
  readonly wallet: WalletView;
}

export const decodeExecutionDetailsView = (row: {
  readonly execution: unknown;
  readonly actor: unknown;
  readonly sessionKey: unknown;
  readonly wallet: unknown;
  readonly walletKey: unknown;
}): ExecutionDetailsView => ({
  execution: Schema.decodeSync(Execution)(row.execution as any),
  actor: Schema.decodeSync(Actor)(row.actor as any),
  sessionKey: Schema.decodeSync(SessionKey)(row.sessionKey as any),
  wallet: {
    wallet: Schema.decodeSync(Wallet)(row.wallet as any),
    walletKey: Schema.decodeSync(WalletKey)(row.walletKey as any),
  },
});

export const executionListSelection = {
  executionId: execution.id,
  executionNamespace: execution.namespace,
  chainId: sql<string>`${execution.data} ->> 'chainId'`,
  transactionHash: sql<string>`${execution.data} ->> 'transactionHash'`,
  executionCreatedAt: execution.createdAt,
  walletId: wallet.id,
  walletNamespace: wallet.namespace,
  walletAddress: sql<string>`${wallet.data} ->> 'address'`,
  walletMetadata: wallet.metadata,
  sessionKeyId: sessionKey.id,
  sessionKeyNamespace: sessionKey.namespace,
  sessionKeyMetadata: sessionKey.metadata,
  actorType: actor.type,
} as const;
