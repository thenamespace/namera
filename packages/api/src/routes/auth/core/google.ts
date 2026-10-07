import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

import { AccountId, GoogleAuthError } from "@namera-ai/protocol";
import {
  ConnectedAccountsResponse,
  GoogleConfigurationResponse,
  StartGoogleResponse,
  StartGoogleSignInRequest,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class GoogleGroup extends HttpApiGroup.make("google")
  .add(
    HttpApiEndpoint.get("configuration", "/configuration", {
      success: GoogleConfigurationResponse,
    }),
    HttpApiEndpoint.post("start", "/start", {
      payload: StartGoogleSignInRequest,
      success: StartGoogleResponse,
      error: [GoogleAuthError, ...CommonErrors],
    }),
    HttpApiEndpoint.get("callback", "/callback", { success: Schema.Void, error: CommonErrors }),
  )
  .prefix("/auth/google") {}

export class ConnectedAccountsGroup extends HttpApiGroup.make("connectedAccounts")
  .add(
    HttpApiEndpoint.get("list", "/", { success: ConnectedAccountsResponse, error: CommonErrors }),
    HttpApiEndpoint.post("connectGoogle", "/google", {
      success: StartGoogleResponse,
      error: [GoogleAuthError, ...CommonErrors],
    }),
    HttpApiEndpoint.delete("unlink", "/:accountId", {
      params: { accountId: AccountId },
      success: Schema.Void,
      error: [GoogleAuthError, ...CommonErrors],
    }),
  )
  .middleware(Authorization)
  .prefix("/auth/connected-accounts") {}
