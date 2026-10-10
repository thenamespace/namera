import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { BillingErrors, SignatureError } from "@namera-ai/protocol";
import {
  SignRequestHeaders,
  VerifySignatureRequest,
  VerifySignatureResponse,
  PrepareSignatureRequest,
  PrepareSignatureResponse,
  CompleteSignatureRequest,
  CompleteSignatureResponse,
  PrepareManagedSignatureRequest,
  PrepareManagedSignatureResponse,
  CompleteManagedSignatureRequest,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SignatureGroup extends HttpApiGroup.make("signature")
  .add(
    HttpApiEndpoint.post("prepareManaged", "/managed/prepare", {
      payload: PrepareManagedSignatureRequest,
      headers: SignRequestHeaders,
      success: PrepareManagedSignatureResponse,
      error: [SignatureError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Reserve message or typed-data signing by a 1Claw session"),
    HttpApiEndpoint.post("completeManaged", "/managed/complete", {
      payload: CompleteManagedSignatureRequest,
      success: CompleteSignatureResponse,
      error: [SignatureError, ...CommonErrors],
    }).annotate(
      OpenApi.Summary,
      "Sign the stored managed payload without storing the returned signature",
    ),
    HttpApiEndpoint.post("prepare", "/prepare", {
      payload: PrepareSignatureRequest,
      headers: SignRequestHeaders,
      success: PrepareSignatureResponse,
      error: [SignatureError, ...BillingErrors, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Prepare a locally signed session signature"),
  )
  .add(
    HttpApiEndpoint.post("complete", "/complete", {
      payload: CompleteSignatureRequest,
      success: CompleteSignatureResponse,
      error: [SignatureError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Verify and meter a local session signature"),
  )
  .add(
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifySignatureRequest,
      success: VerifySignatureResponse,
      error: [SignatureError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Verify an EVM smart-account signature"),
  )
  .annotate(OpenApi.Description, "Namespace-discriminated programmable wallet signatures")
  .middleware(Authorization)
  .prefix("/signatures") {}
