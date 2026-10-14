// Drizzle rows are untrusted persistence values and are decoded before leaving
// the repository boundary.
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
  SigningKey,
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
    id: Schema.decodeUnknownSync(ExecutionId)(row.executionId),
    namespace: Schema.decodeUnknownSync(Schema.Literal("eip155"))(row.executionNamespace),
    chainId: Schema.decodeUnknownSync(SupportedEvmChainId)(row.chainId),
    transactionHash: Schema.decodeUnknownSync(TransactionHash)(row.transactionHash),
    createdAt: Schema.decodeUnknownSync(Schema.DateTimeUtcFromDate)(row.executionCreatedAt),
  },
  wallet: {
    id: Schema.decodeUnknownSync(WalletId)(row.walletId),
    namespace: Schema.decodeUnknownSync(Schema.Literal("eip155"))(row.walletNamespace),
    address: Schema.decodeUnknownSync(EthereumAddress)(row.walletAddress),
    metadata: Schema.decodeUnknownSync(WalletMetadata)(row.walletMetadata),
  },
  sessionKey: {
    id: Schema.decodeUnknownSync(SessionKeyId)(row.sessionKeyId),
    namespace: Schema.decodeUnknownSync(Schema.Literal("eip155"))(row.sessionKeyNamespace),
    metadata: Schema.decodeUnknownSync(SessionKeyMetadata)(row.sessionKeyMetadata),
  },
  actorType: Schema.decodeUnknownSync(ActorType)(row.actorType),
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
  readonly signingKey: unknown;
}): ExecutionDetailsView => ({
  execution: Schema.decodeUnknownSync(Execution)(row.execution),
  actor: Schema.decodeUnknownSync(Actor)(row.actor),
  sessionKey: Schema.decodeUnknownSync(SessionKey)(row.sessionKey),
  wallet: {
    wallet: Schema.decodeUnknownSync(Wallet)(row.wallet),
    signingKey: Schema.decodeUnknownSync(SigningKey)(row.signingKey),
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
