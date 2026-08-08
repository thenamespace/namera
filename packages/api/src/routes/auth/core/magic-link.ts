import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { MagicLinkError } from "@namera-ai/protocol";
import {
  GetMagicLinkRequest,
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  VerifyMagicLinkRequest,
  VerifyMagicLinkResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";

export class MagicLinkGroup extends HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("request", "/request", {
      payload: RequestMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: RequestMagicLinkResponse,
    }),
    HttpApiEndpoint.get("get", "/", {
      query: GetMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: Schema.String.pipe(
        HttpApiSchema.asText({ contentType: "text/html; charset=utf-8" }),
      ),
    }),
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifyMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: VerifyMagicLinkResponse,
    }),
  )
  .prefix("/auth/magic-link") {}
