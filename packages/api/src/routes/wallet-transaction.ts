import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { BillingLimitExceededError, WalletTransactionError } from "@namera-ai/protocol";
import {
  ExecuteRequestHeaders,
  WalletTransactionParams,
  GetWalletTransactionRequest,
  PrepareWalletTransactionRequest,
  PrepareWalletTransactionResponse,
  CompleteWalletTransactionRequest,
  CompleteWalletTransactionResponse,
  GetWalletTransactionResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

const errors = [...CommonErrors, WalletTransactionError, BillingLimitExceededError];
export class WalletTransactionGroup extends HttpApiGroup.make("walletTransaction")
  .add(
    HttpApiEndpoint.post("cancel", "/wallets/:walletId/transactions/:operationId/cancel", {
      params: GetWalletTransactionRequest,
      success: GetWalletTransactionResponse,
      error: errors,
    }).annotate(
      OpenApi.Summary,
      "Cancel an unsigned owner transaction and release its reservations",
    ),
    HttpApiEndpoint.post("prepare", "/wallets/:walletId/transactions/prepare", {
      params: WalletTransactionParams,
      headers: ExecuteRequestHeaders,
      payload: PrepareWalletTransactionRequest,
      success: PrepareWalletTransactionResponse,
      error: errors,
    }),
    HttpApiEndpoint.post("complete", "/wallets/:walletId/transactions/complete", {
      params: WalletTransactionParams,
      payload: CompleteWalletTransactionRequest,
      success: CompleteWalletTransactionResponse,
      error: errors,
    }),
    HttpApiEndpoint.get("get", "/wallets/:walletId/transactions/:operationId", {
      params: GetWalletTransactionRequest,
      success: GetWalletTransactionResponse,
      error: errors,
    }),
  )
  .middleware(Authorization)
  .annotate(OpenApi.Exclude, true) {}
