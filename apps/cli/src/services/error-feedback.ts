import { Cause, Predicate, Schema } from "effect";

export class CliFailure extends Schema.TaggedError<CliFailure>()("CliFailure", {
  code: Schema.String,
  message: Schema.String,
  nextStep: Schema.String,
  retryable: Schema.Boolean,
}) {}

const keyringHelp =
  "Unlock your OS keyring and allow Namera access. On Linux, start a Secret Service session. Do not use sudo or delete existing keys.";
const statusHelp =
  "Check execution status in the dashboard before submitting again; repeating a transfer can send funds twice.";

const feedback = {
  INTERNAL_ERROR: [
    "Namera could not complete this command.",
    "Check the dashboard for any completed operation, then contact support with the command name and CLI version. Do not share keys, tokens, or passphrases.",
  ],
  INVALID_ARGUMENT: [
    "The command input is invalid.",
    "Run the command with --help and check the required arguments and formats.",
  ],
  INVALID_EXPORT: [
    "The encrypted session-key export is invalid or incomplete.",
    "Copy the entire import command from the dashboard. Do not paste a private key.",
  ],
  DECRYPT_FAILED: [
    "The export could not be decrypted.",
    "Check the export passphrase and copy the complete export again. An incorrect passphrase or damaged export can cause this.",
  ],
  IMPORT_FAILED: [
    "The session key could not be saved safely.",
    "Check access to the Namera configuration directory and OS keyring. Keep your encrypted export; do not delete existing keys.",
  ],
  ALREADY_IMPORTED: [
    "This session key is already imported.",
    "Use the existing local key. No existing key was overwritten.",
  ],
  KEYRING_UNAVAILABLE: ["Namera could not access the OS keyring.", keyringHelp],
  UNLOCK_UNAVAILABLE: ["The local key's unlock credential is unavailable.", keyringHelp],
  READ_FAILED: [
    "The local session-key file is missing, unreadable, or unsafe.",
    "Check that you are using the same OS user and API host. Keep your backup and contact support before changing stored files.",
  ],
  ORIGIN_MISMATCH: [
    "This session key belongs to a different API host.",
    "Use the --host shown in the dashboard import command. Do not edit the encrypted export.",
  ],
  PROFILE_REQUIRED: [
    "This profile has no saved API host.",
    "Use --host with the API origin shown in the dashboard to import before login.",
  ],
  UNAUTHORIZED: [
    "Your authorization is missing, expired, or revoked.",
    "Run namera login with the intended --profile and --host, then approve access in the browser. For MCP, use namera mcp login with the same profile.",
  ],
  INSUFFICIENT_SCOPE: [
    "Your authorization does not allow this operation.",
    "Sign in again and grant the required permissions to the intended session key.",
  ],
  AUTH_EXPIRED: [
    "The sign-in request expired.",
    "Run namera login again and complete browser approval before it expires.",
  ],
  AUTH_DENIED: [
    "Sign-in was declined.",
    "Run login again only if you want to authorize Namera, then approve in the browser.",
  ],
  AUTH_BUSY: [
    "Another Namera command is updating credentials.",
    "Wait for the other command to finish, then try again. Do not delete credential files.",
  ],
  MCP_LOGIN_FAILED: [
    "MCP sign-in could not be completed.",
    "Check browser consent, the API connection, and your OS keyring. Run namera mcp login with the same --profile and --host.",
  ],
  MCP_LOGOUT_FAILED: [
    "MCP sign-out could not be completed.",
    "Revoke the connection in Namera settings, then check your OS keyring and retry logout.",
  ],
  CONFIG_UNAVAILABLE: [
    "Namera's saved configuration could not be read or written.",
    "Check the configuration directory's permissions and available disk space. Preserve your existing configuration and keys.",
  ],
  INVALID_HOST: [
    "The API host is invalid.",
    "Use a complete API URL, such as https://api.namera.ai, with --host or NAMERA_API_URL.",
  ],
  UPSTREAM_UNAVAILABLE: [
    "The Namera API could not be reached or is unavailable.",
    `Check your connection and API host. ${statusHelp}`,
  ],
  RATE_LIMITED: ["Too many requests were sent.", `Wait before trying again. ${statusHelp}`],
  LIMIT_EXCEEDED: [
    "The workspace has reached a usage limit.",
    "Check billing and usage in the dashboard before trying again.",
  ],
  NETWORK_PAUSED: [
    "New operations on this network are paused.",
    "Wait until the network is re-enabled. Do not repeatedly submit the operation.",
  ],
  POLICY_DENIED: [
    "The session-key policy does not allow this operation.",
    "Review its policies in the dashboard and simulate an allowed operation. Do not bypass the policy.",
  ],
  WALLET_NOT_FOUND: [
    "The wallet was not found or is not delegated to this client.",
    "Run namera wallet list and use an accessible wallet ID.",
  ],
  SESSION_KEY_NOT_FOUND: [
    "The session key was not found or is not delegated to this client.",
    "Run namera session-key list and check the selected profile.",
  ],
  SESSION_KEY_NOT_ACTIVE: [
    "The session key is not active.",
    "Approve a network in the dashboard before authorizing the key. A revoked key cannot be reused.",
  ],
  EXECUTION_NOT_FOUND: [
    "The execution was not found.",
    "Check the execution ID, profile, and API host. Use namera execution list to find accessible executions.",
  ],
  RESOURCE_NOT_FOUND: [
    "The requested resource was not found or is not accessible.",
    "Check its ID and the selected profile and API host.",
  ],
  REQUEST_CONFLICT: [
    "The request conflicts with the current state.",
    "Refresh the resource in the dashboard. Check for an existing execution before submitting again.",
  ],
  EXECUTION_SUBMISSION_NOT_FOUND: [
    "The execution submission was not found.",
    "Use the submission ID returned by the original execution, with the same profile and API host.",
  ],
  NO_AUTHORIZED_SESSION_KEY: [
    "No authorized session key permits this operation.",
    "Enable the intended network in the dashboard and authorize the key for this client.",
  ],
  IDEMPOTENCY_CONFLICT: ["This request conflicts with an earlier operation.", statusHelp],
  EXECUTION_FAILED: ["The execution failed.", statusHelp],
  EXECUTION_UNAVAILABLE: ["The execution could not be completed.", statusHelp],
  SIGNING_FAILED: [
    "The signature could not be created.",
    "Check the session key's status, signature permissions, and local keyring access.",
  ],
  SIGNATURE_UNAVAILABLE: [
    "Signature creation is unavailable.",
    "Check the API connection and session-key status before trying again.",
  ],
  VERIFICATION_FAILED: [
    "The signature could not be verified.",
    "Check the original message, signature, wallet address, and network.",
  ],
  LOCAL_SIGNER_REQUIRED: [
    "This operation needs an imported local session key.",
    "Import the encrypted session key using the dashboard command, then authorize it for this client.",
  ],
  LOCAL_SIGNER_UNAVAILABLE: [
    "The authorized local session key is unavailable.",
    "Check your OS keyring, API host, and imported key. Import the dashboard export if the key is not already stored.",
  ],
  PREPARED_EXECUTION_INVALID: [
    "The prepared operation does not match local authorization.",
    "Do not sign it. Check the selected session, network, permissions, and gas ceiling.",
  ],
  PREPARED_SIGNATURE_INVALID: [
    "The signature request does not match local consent.",
    "Do not sign it. Check the original payload and session-key signature permissions.",
  ],
  LOCAL_SIGNATURE_INVALID: [
    "The local signature failed verification.",
    "Check the imported key and its session binding. Do not submit this signature.",
  ],
} as const;

export const cliFailure = (code: keyof typeof feedback): CliFailure =>
  new CliFailure({
    code,
    message: feedback[code][0],
    nextStep: feedback[code][1],
    // An ambiguous execution must never be advertised as safe to retry automatically.
    retryable: false,
  });

export const errorFeedback = (failure: unknown, depth = 0): CliFailure => {
  if (failure instanceof CliFailure) return failure;
  if (Schema.isSchemaError(failure)) return cliFailure("INVALID_ARGUMENT");
  if (!Predicate.isObject(failure) || depth > 4) return cliFailure("INTERNAL_ERROR");
  if (Cause.isUnknownError(failure)) return errorFeedback(failure.cause, depth + 1);
  if (failure.cause instanceof CliFailure) return failure.cause;
  const code = failure.code;
  if (typeof code === "string" && Object.hasOwn(feedback, code))
    return cliFailure(code as keyof typeof feedback);
  if (code === "invalid_grant" || code === "invalid_token") return cliFailure("UNAUTHORIZED");
  if (code === "access_denied") return cliFailure("AUTH_DENIED");
  if (code === "expired_token") return cliFailure("AUTH_EXPIRED");
  if (code === "temporarily_unavailable") return cliFailure("UPSTREAM_UNAVAILABLE");
  if (code === "ERR_INVALID_URL") return cliFailure("INVALID_HOST");
  if (code === "EACCES" || code === "EPERM" || code === "ENOSPC")
    return cliFailure("CONFIG_UNAVAILABLE");
  if (failure.kind === "contract") return cliFailure("INVALID_ARGUMENT");
  if (failure.kind === "network") return cliFailure("UPSTREAM_UNAVAILABLE");
  if (failure.status === 401 || failure.tag === "Unauthorized") return cliFailure("UNAUTHORIZED");
  if (failure.status === 403 || failure.tag === "Forbidden")
    return cliFailure("INSUFFICIENT_SCOPE");
  if (failure.status === 429) return cliFailure("RATE_LIMITED");
  if (failure.status === 404) return cliFailure("RESOURCE_NOT_FOUND");
  if (failure.status === 409) return cliFailure("REQUEST_CONFLICT");
  if (failure.status === 400 || failure.status === 422) return cliFailure("INVALID_ARGUMENT");
  if (typeof failure.status === "number" && failure.status >= 500)
    return cliFailure("UPSTREAM_UNAVAILABLE");
  return cliFailure("INTERNAL_ERROR");
};

export const formatFailure = (failure: CliFailure, structured: boolean) => {
  const error = {
    code: failure.code,
    message: failure.message,
    nextStep: failure.nextStep,
    retryable: failure.retryable,
  };
  return structured
    ? JSON.stringify({ error })
    : `Error: ${error.message}\nNext: ${error.nextStep}\nCode: ${error.code}`;
};
