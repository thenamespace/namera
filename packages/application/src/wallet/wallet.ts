import { Effect } from "effect";

import type { WalletView } from "@namera-ai/database";
import type {
  ActorId,
  BillingError,
  OrganizationId,
  WalletCreationError,
  WalletId,
  WalletNotFoundError,
  PortfolioUnavailableError,
} from "@namera-ai/protocol";
import type {
  CreateWalletRequest,
  GetWalletPortfolioRequest,
  PortfolioResponse,
  UpdateWalletRequest,
} from "@namera-ai/protocol/dto";

import type { DataApplication } from "#/data/index";

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
  readonly getPortfolio: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
    readonly request: GetWalletPortfolioRequest;
  }) => Effect.Effect<PortfolioResponse, WalletNotFoundError | PortfolioUnavailableError>;
  readonly update: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly walletId: WalletId;
    readonly request: UpdateWalletRequest;
  }) => Effect.Effect<WalletView, WalletNotFoundError>;
}

export const makeWalletApplication = (data: DataApplication) =>
  Effect.gen(function* () {
    const create = yield* makeCreateWallet;
    const read = yield* makeReadWallets(data);
    const update = yield* makeUpdateWallet;

    return { create, ...read, update } satisfies WalletApplication;
  });
