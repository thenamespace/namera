import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import {
  OAuthAuthorizationError,
  OAuthAuthorizationRequestError,
  OAuthDeviceAuthorizationError,
} from "@namera-ai/protocol";
import {
  ApproveOAuthDeviceAuthorizationRequest,
  ApproveOAuthAuthorizationRequest,
  DenyOAuthDeviceAuthorizationRequest,
  DenyOAuthAuthorizationRequest,
  GetOAuthDeviceAuthorizationRequest,
  OAuthDeviceAuthorizationDecisionResponse,
  OAuthDeviceAuthorizationResponse,
  GetOAuthAuthorizationRequest,
  GetOAuthAuthorizationResponse,
  GetOAuthAuthorizationRequestRequest,
  GetOAuthAuthorizationRequestResponse,
  ListOAuthAuthorizationsResponse,
  OAuthAuthorizationRedirectResponse,
  RevokeOAuthAuthorizationRequest,
  RevokeOAuthAuthorizationResponse,
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
      error: [OAuthAuthorizationRequestError, OAuthAuthorizationError, ...CommonErrors],
      success: OAuthAuthorizationRedirectResponse,
    }).annotate(OpenApi.Summary, "Approve an OAuth authorization request"),
    HttpApiEndpoint.post("denyOAuthAuthorizationRequest", "/authorization-requests/deny", {
      payload: DenyOAuthAuthorizationRequest,
      error: [OAuthAuthorizationRequestError, ...CommonErrors],
      success: OAuthAuthorizationRedirectResponse,
    }).annotate(OpenApi.Summary, "Deny an OAuth authorization request"),
    HttpApiEndpoint.get("getOAuthDeviceAuthorization", "/device-authorizations", {
      query: GetOAuthDeviceAuthorizationRequest,
      error: [OAuthDeviceAuthorizationError, ...CommonErrors],
      success: OAuthDeviceAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Get and claim a CLI device authorization request"),
    HttpApiEndpoint.post("approveOAuthDeviceAuthorization", "/device-authorizations/approve", {
      payload: ApproveOAuthDeviceAuthorizationRequest,
      error: [OAuthDeviceAuthorizationError, ...CommonErrors],
      success: OAuthDeviceAuthorizationDecisionResponse,
    }).annotate(OpenApi.Summary, "Approve a CLI device authorization request"),
    HttpApiEndpoint.post("denyOAuthDeviceAuthorization", "/device-authorizations/deny", {
      payload: DenyOAuthDeviceAuthorizationRequest,
      error: [OAuthDeviceAuthorizationError, ...CommonErrors],
      success: OAuthDeviceAuthorizationDecisionResponse,
    }).annotate(OpenApi.Summary, "Deny a CLI device authorization request"),
    HttpApiEndpoint.get("listMcpAuthorizations", "/authorizations", {
      error: CommonErrors,
      success: ListOAuthAuthorizationsResponse,
    }).annotate(OpenApi.Summary, "List MCP authorizations for the active organization"),
    HttpApiEndpoint.get("getMcpAuthorization", "/authorizations/:authorizationId", {
      params: GetOAuthAuthorizationRequest,
      error: [OAuthAuthorizationError, ...CommonErrors],
      success: GetOAuthAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Get an MCP authorization"),
    HttpApiEndpoint.post("revokeMcpAuthorization", "/authorizations/revoke", {
      payload: RevokeOAuthAuthorizationRequest,
      error: [OAuthAuthorizationError, ...CommonErrors],
      success: RevokeOAuthAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Revoke an MCP authorization"),
    HttpApiEndpoint.get("listCliAuthorizations", "/cli-authorizations", {
      error: CommonErrors,
      success: ListOAuthAuthorizationsResponse,
    }).annotate(OpenApi.Summary, "List CLI authorizations for the active organization"),
    HttpApiEndpoint.get("getCliAuthorization", "/cli-authorizations/:authorizationId", {
      params: GetOAuthAuthorizationRequest,
      error: [OAuthAuthorizationError, ...CommonErrors],
      success: GetOAuthAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Get a CLI authorization"),
    HttpApiEndpoint.post("revokeCliAuthorization", "/cli-authorizations/revoke", {
      payload: RevokeOAuthAuthorizationRequest,
      error: [OAuthAuthorizationError, ...CommonErrors],
      success: RevokeOAuthAuthorizationResponse,
    }).annotate(OpenApi.Summary, "Revoke a CLI authorization"),
  )
  .annotate(OpenApi.Description, "OAuth consent and delegated authorization management")
  .middleware(Authorization)
  .prefix("/oauth") {}
