import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { SignatureError } from "@namera-ai/protocol";
import { SignRequest, SignResponse } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SignatureGroup extends HttpApiGroup.make("signature")
  .add(
    HttpApiEndpoint.post("sign", "/", {
      payload: SignRequest,
      success: SignResponse,
      error: [SignatureError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Sign a message or typed data through an authorized session key"),
  )
  .annotate(OpenApi.Description, "Namespace-discriminated programmable wallet signatures")
  .middleware(Authorization)
  .prefix("/signatures") {}
