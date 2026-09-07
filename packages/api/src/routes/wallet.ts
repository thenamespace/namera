import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";

import {
  BillingErrors,
  PortfolioUnavailableError,
  PasskeyRegistrationError,
  PasskeyVerificationError,
  WalletCreationError,
  WalletNotFoundError,
} from "@namera-ai/protocol";
import {
  CreateWalletRequest,
  CreateWalletResponse,
  GetWalletRequest,
  GetWalletResponse,
  GetWalletPortfolioRequest,
  PortfolioResponse,
  PasskeyRegistrationOptionsResponse,
  ListWalletsResponse,
  UpdateWalletRequest,
  UpdateWalletResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class WalletGroup extends HttpApiGroup.make("wallet")
  .add(
    HttpApiEndpoint.post("createPasskeyRegistrationOptions", "/passkey/registration-options", {
      success: PasskeyRegistrationOptionsResponse,
      error: [PasskeyRegistrationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Create passkey registration options for a wallet"),
    HttpApiEndpoint.post("create", "/", {
      payload: CreateWalletRequest,
      success: CreateWalletResponse.pipe(HttpApiSchema.status("Created")),
      error: [WalletCreationError, PasskeyVerificationError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Create a wallet"),
    HttpApiEndpoint.get("list", "/", {
      success: ListWalletsResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List wallets for the active organization"),
    HttpApiEndpoint.get("get", "/:walletId", {
      params: GetWalletRequest,
      success: GetWalletResponse,
      error: [WalletNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get a wallet in the active organization"),
    HttpApiEndpoint.get("getPortfolio", "/:walletId/portfolio", {
      params: GetWalletRequest,
      query: GetWalletPortfolioRequest,
      success: PortfolioResponse,
      error: [WalletNotFoundError, PortfolioUnavailableError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get the paginated cross-chain portfolio for a wallet"),
    HttpApiEndpoint.post("update", "/:walletId/update", {
      params: GetWalletRequest,
      payload: UpdateWalletRequest,
      success: UpdateWalletResponse,
      error: [WalletNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Update wallet metadata"),
  )
  .annotate(OpenApi.Description, "Organization wallets and smart accounts")
  .middleware(Authorization)
  .prefix("/wallets") {}
