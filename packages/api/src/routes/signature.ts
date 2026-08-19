import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { BillingErrors, SignatureError } from "@namera-ai/protocol";
import {
  SignRequest,
  SignRequestHeaders,
  SignResponse,
  VerifySignatureRequest,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SignatureGroup extends HttpApiGroup.make("signature")
  .add(
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifySignatureRequest,
      success: VerifySignatureResponse,
      error: [SignatureError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Verify an EVM smart-account signature"),
  )
  .add(
    HttpApiEndpoint.post("sign", "/", {
      payload: SignRequest,
      headers: SignRequestHeaders,
      success: SignResponse,
      error: [SignatureError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Sign a message or typed data through an authorized session key"),
  )
  .annotate(OpenApi.Description, "Namespace-discriminated programmable wallet signatures")
  .middleware(Authorization)
  .prefix("/signatures") {}
