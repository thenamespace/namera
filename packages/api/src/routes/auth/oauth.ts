import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { McpAuthorizationError, OAuthAuthorizationRequestError } from "@namera-ai/protocol";
import {
  ApproveOAuthAuthorizationRequest,
  DenyOAuthAuthorizationRequest,
  GetMcpAuthorizationRequest,
  GetMcpAuthorizationResponse,
  GetOAuthAuthorizationRequestRequest,
  GetOAuthAuthorizationRequestResponse,
  ListMcpAuthorizationsResponse,
  OAuthAuthorizationRedirectResponse,
  RevokeMcpAuthorizationRequest,
  RevokeMcpAuthorizationResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class OAuthGroup extends HttpApiGroup.make("oauth")
  .add(
    HttpApiEndpoint.get("getOAuthAuthorizationRequest", "/authorization-requests/:requestId", {
      params: GetOAuthAuthorizationRequestRequest,
      error: [OAuthAuthorizationRequestError, ...CommonErrors],
      success: GetOAuthAuthorizationRequestResponse,
    }).annotate(OpenApi.Summary, "Get a pending OAuth authorization request"),
    HttpApiEndpoint.post("approveOAuthAuthorizationRequest", "/authorization-requests/approve", {
      payload: ApproveOAuthAuthorizationRequest,
      error: [OAuthAuthorizationRequestError, McpAuthorizationError, ...CommonErrors],
      success: OAuthAuthorizationRedirectResponse,
    }).annotate(OpenApi.Summary, "Approve an OAuth authorization request"),
    HttpApiEndpoint.post("denyOAuthAuthorizationRequest", "/authorization-requests/deny", {
      payload: DenyOAuthAuthorizationRequest,
      error: [OAuthAuthorizationRequestError, ...CommonErrors],
      success: OAuthAuthorizationRedirectResponse,
    }).annotate(OpenApi.Summary, "Deny an OAuth authorization request"),
    HttpApiEndpoint.get("listMcpAuthorizations", "/authorizations", {
      error: CommonErrors,
      success: ListMcpAuthorizationsResponse,
    }).annotate(OpenApi.Summary, "List MCP authorizations for the active organization"),
    HttpApiEndpoint.get("getMcpAuthorization", "/authorizations/:authorizationId", {
      params: GetMcpAuthorizationRequest,
      error: [McpAuthorizationError, ...CommonErrors],
      success: GetMcpAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Get an MCP authorization"),
    HttpApiEndpoint.post("revokeMcpAuthorization", "/authorizations/revoke", {
      payload: RevokeMcpAuthorizationRequest,
      error: [McpAuthorizationError, ...CommonErrors],
      success: RevokeMcpAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Revoke an MCP authorization"),
  )
  .annotate(OpenApi.Description, "OAuth consent and MCP authorization management")
  .middleware(Authorization)
  .prefix("/oauth") {}
