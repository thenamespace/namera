import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import {
  CreateSmartAccountPayload,
  ListSmartAccountsResponse,
  SmartAccount,
} from "@namera-ai/schema";

import { Authorization } from "@/middlewares";

export const smartAccountGroup = HttpApiGroup.make("smartAccount")
  .add(
    HttpApiEndpoint.post("create", "/create")
      .setPayload(CreateSmartAccountPayload)
      .addSuccess(SmartAccount, { status: 200 })
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.get("list", "/list")
      .addSuccess(ListSmartAccountsResponse, { status: 200 })
      .middleware(Authorization),
  )
  .prefix("/smart-account");
