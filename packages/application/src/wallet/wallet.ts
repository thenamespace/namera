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
  PasskeyRegistrationError,
  PasskeyVerificationError,
  UserId,
} from "@namera-ai/protocol";
import type {
  CreateWalletRequest,
  GetWalletPortfolioRequest,
  PortfolioResponse,
  UpdateWalletRequest,
  PasskeyRegistrationOptionsResponse,
} from "@namera-ai/protocol/dto";

import type { DataApplication } from "#/data/index";

import { makeCreateWallet } from "./create.js";
import { makePasskeyRegistrationApplication } from "./passkey-registration.js";
import { makeReadWallets } from "./read.js";
import { makeUpdateWallet } from "./update.js";

export interface WalletApplication {
  readonly createPasskeyRegistrationOptions: (input: {
    readonly organizationId: OrganizationId;
    readonly userId: UserId;
    readonly userName: string;
    readonly userDisplayName: string;
  }) => Effect.Effect<PasskeyRegistrationOptionsResponse, PasskeyRegistrationError>;
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly userId: UserId;
    readonly request: CreateWalletRequest;
  }) => Effect.Effect<WalletView, BillingError | PasskeyVerificationError | WalletCreationError>;
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
    const createPasskeyRegistrationOptions = yield* makePasskeyRegistrationApplication;
    const read = yield* makeReadWallets(data);
    const update = yield* makeUpdateWallet;

    return {
      create,
      createPasskeyRegistrationOptions,
      ...read,
      update,
    } satisfies WalletApplication;
  });
