import { Schema } from "effect";

const Id = Schema.NonEmptyString;
const Seconds = Schema.Int.check(Schema.isGreaterThan(0));
const Secret = Schema.RedactedFromValue(Schema.NonEmptyString);

export const ConnectionResponse = Schema.Struct({
  connection_id: Id,
  user_id: Id,
  status: Id,
});
export const ConnectedUsersResponse = Schema.Struct({
  users: Schema.Array(
    Schema.Struct({
      ...ConnectionResponse.fields,
      external_subject: Id,
    }),
  ),
});
export const UpsertResponse = Schema.Struct({ connection_id: Id });
export const ClaimResponse = Schema.Struct({
  connection_id: Id,
  claim_token: Secret,
  expires_in: Seconds,
});
export const BootstrapResponse = Schema.Struct({
  ...ClaimResponse.fields,
  summary: Schema.Record(Schema.String, Schema.Unknown),
});
export const TemplateResponse = Schema.Struct({
  id: Id,
  platform_app_id: Id,
  version: Schema.Int,
  is_active: Schema.Boolean,
  spec: Schema.Record(Schema.String, Schema.Unknown),
});
export const RedeemResponse = Schema.Struct({
  connection_id: Id,
  auth_token: Secret,
  expires_in: Seconds,
});
export const IdentityResponse = Schema.Struct({ id: Id });
export const AgentResponse = Schema.Struct({
  id: Id,
  is_active: Schema.Boolean,
  intents_api_enabled: Schema.Boolean,
  raw_signing_enabled: Schema.optionalKey(Schema.Boolean),
  raw_signing_policy: Schema.optionalKey(Schema.Literals(["allow", "deny", "approve"])),
});
export const AgentCreatedResponse = Schema.Struct({ agent: AgentResponse, api_key: Secret });
export const KeyResponse = Schema.Struct({
  id: Id,
  agent_id: Id,
  chain: Id,
  curve: Id,
  public_key: Id,
  address: Id,
  key_version: Schema.Int.check(Schema.isGreaterThan(0)),
  is_active: Schema.Boolean,
  custody: Schema.optionalKey(Schema.Literals(["server", "client_tss"])),
});
export const KeysResponse = Schema.Struct({ keys: Schema.Array(KeyResponse) });
export const TokenResponse = Schema.Struct({ access_token: Secret, expires_in: Seconds });
export const SignResponse = Schema.Struct({
  intent_type: Schema.Literal("eip712_digest"),
  chain: Schema.Literal("ethereum"),
  from: Id,
  signature: Id,
  typed_data_hash: Id,
});
