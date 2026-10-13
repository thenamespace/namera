import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { WalletSignatureError } from "@namera-ai/protocol";
import {
  WalletSignatureParams,
  PrepareWalletSignatureHeaders,
  PrepareWalletSignatureRequest,
  PrepareWalletSignatureResponse,
  CompleteWalletSignatureRequest,
  CompleteWalletSignatureResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class WalletSignatureGroup extends HttpApiGroup.make("walletSignature")
  .add(
    HttpApiEndpoint.post("prepare", "/wallets/:walletId/signatures/prepare", {
      params: WalletSignatureParams,
      headers: PrepareWalletSignatureHeaders,
      payload: PrepareWalletSignatureRequest,
      success: PrepareWalletSignatureResponse,
      error: [...CommonErrors, WalletSignatureError],
    }),
    HttpApiEndpoint.post("complete", "/wallets/:walletId/signatures/complete", {
      params: WalletSignatureParams,
      payload: CompleteWalletSignatureRequest,
      success: CompleteWalletSignatureResponse,
      error: [...CommonErrors, WalletSignatureError],
    }),
  )
  .middleware(Authorization)
  .annotate(OpenApi.Exclude, true) {}
