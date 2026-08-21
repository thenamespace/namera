import { Effect } from "effect";

import type { WalletView } from "@namera-ai/database";
import type {
  ActorId,
  BillingError,
  OrganizationId,
  WalletCreationError,
  WalletId,
  WalletNotFoundError,
  WalletAssetsUnavailableError,
} from "@namera-ai/protocol";
import type {
  CreateWalletRequest,
  ListWalletAssetsRequest,
  ListWalletAssetsResponse,
  UpdateWalletRequest,
} from "@namera-ai/protocol/dto";

import { makeCreateWallet } from "./create.js";
import { makeReadWallets } from "./read.js";
import { makeUpdateWallet } from "./update.js";

export interface WalletApplication {
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateWalletRequest;
  }) => Effect.Effect<WalletView, BillingError | WalletCreationError>;
  readonly list: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<ReadonlyArray<WalletView>>;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
  }) => Effect.Effect<WalletView, WalletNotFoundError>;
  readonly listAssets: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
    readonly request: ListWalletAssetsRequest;
  }) => Effect.Effect<ListWalletAssetsResponse, WalletNotFoundError | WalletAssetsUnavailableError>;
  readonly update: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly walletId: WalletId;
    readonly request: UpdateWalletRequest;
  }) => Effect.Effect<WalletView, WalletNotFoundError>;
}

export const makeWalletApplication = Effect.gen(function* () {
  const create = yield* makeCreateWallet;
  const read = yield* makeReadWallets;
  const update = yield* makeUpdateWallet;

  return { create, ...read, update } satisfies WalletApplication;
});
