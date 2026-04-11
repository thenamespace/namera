import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi";

import { Authorization, Unauthorized } from "@/middlewares";
import {
  CreateSmartAccountRequest,
  CreateSmartAccountResponse,
  GetSmartAccountRequest,
  GetSmartAccountResponse,
  ListSmartAccountsResponse,
} from "@namera-ai/schema";

export const smartAccountGroup = HttpApiGroup.make("smartAccount")
  .add(
    HttpApiEndpoint.get("getSmartAccount", "/get", {
      params: GetSmartAccountRequest,
      success: GetSmartAccountResponse.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .add(
    HttpApiEndpoint.get("listSmartAccounts", "/list", {
      success: ListSmartAccountsResponse.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .add(
    HttpApiEndpoint.post("createSmartAccount", "/create", {
      payload: CreateSmartAccountRequest,
      success: CreateSmartAccountResponse.pipe(HttpApiSchema.status(200)),
      error: Unauthorized.pipe(HttpApiSchema.status(401)),
    }),
  )
  .middleware(Authorization)
  .prefix("/smart-account");
