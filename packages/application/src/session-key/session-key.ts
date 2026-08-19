import { Effect } from "effect";

import {
  type ActorId,
  type OrganizationId,
  type SessionKeyCreationError,
  type SessionKeyId,
  type SessionKeyNotFoundError,
  type WalletId,
  type WalletNotFoundError,
} from "@namera-ai/protocol";
import type { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";

import { makeCreateSessionKey } from "./create.js";
import { makeReadSessionKeys } from "./read.js";
import { makeRevokeSessionKey } from "./revoke.js";
import type { SessionKeyView } from "./view.js";

export interface SessionKeyApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateSessionKeyRequest;
  }) => Effect.Effect<SessionKeyView, WalletNotFoundError | SessionKeyCreationError>;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError>;
  readonly listForWallet: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>, WalletNotFoundError>;
  readonly listForOrganization: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>>;
  readonly revoke: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError>;
}

export const makeSessionKeyApplication = Effect.gen(function* () {
  const create = yield* makeCreateSessionKey;
  const read = yield* makeReadSessionKeys;
  const revoke = yield* makeRevokeSessionKey;

  return { create, ...read, revoke } satisfies SessionKeyApplication;
});

export type { SessionKeyView } from "./view.js";
