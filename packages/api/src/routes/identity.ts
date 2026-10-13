import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import {
  EnsUnavailableError,
  IdentityError,
  IdentityPrimaryError,
  WalletNotFoundError,
} from "@namera-ai/protocol";
import {
  CreateIdentityRequest,
  IdentityAccountParams,
  IdentityDetail,
  IdentityListQuery,
  IdentityListResponse,
  IdentityNetworksResponse,
  IdentityParams,
  UpdateIdentityRecordsRequest,
  IdentityPrimaryStatus,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

const errors = [...CommonErrors, EnsUnavailableError, IdentityError, WalletNotFoundError];

export class IdentityGroup extends HttpApiGroup.make("identity")
  .add(
    HttpApiEndpoint.get("primaryStatus", "/wallets/:walletId/identities/:label/primary", {
      params: IdentityParams,
      success: IdentityPrimaryStatus,
      error: [...errors, IdentityPrimaryError],
    }),
    HttpApiEndpoint.get("networks", "/identity/networks", {
      success: IdentityNetworksResponse,
      error: CommonErrors,
    }),
    HttpApiEndpoint.get("list", "/wallets/:walletId/identities", {
      params: IdentityAccountParams,
      query: IdentityListQuery,
      success: IdentityListResponse,
      error: errors,
    }),
    HttpApiEndpoint.post("create", "/wallets/:walletId/identities", {
      params: IdentityAccountParams,
      payload: CreateIdentityRequest,
      success: IdentityDetail,
      error: errors,
    }),
    HttpApiEndpoint.get("get", "/wallets/:walletId/identities/:label", {
      params: IdentityParams,
      success: IdentityDetail,
      error: errors,
    }),
    HttpApiEndpoint.patch("updateRecords", "/wallets/:walletId/identities/:label/records", {
      params: IdentityParams,
      payload: UpdateIdentityRecordsRequest,
      success: IdentityDetail,
      error: errors,
    }),
  )
  .middleware(Authorization)
  .annotate(OpenApi.Exclude, true) {}
