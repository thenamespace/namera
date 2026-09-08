import { Schema } from "effect";

import {
  ExecutionId,
  ExecutionSubmissionId,
  PolicyId,
  SessionKeyId,
  WalletId,
} from "#/common/index";
import { EthereumAddress, EvmTypedData, Hex, SupportedEvmChainId } from "#/evm/index";
import { EvmPolicyDenialCode } from "#/policy/evm/decision";

const McpWalletId = WalletId.annotate({
  description:
    "The Namera wallet ID returned by list_wallets or get_wallet. Do not pass a wallet address or session-key ID.",
});

const McpSessionKeyId = SessionKeyId.annotate({
  description:
    "The session-key ID returned by list_session_keys. Do not pass a wallet ID or wallet address.",
});

const McpChainId = SupportedEvmChainId.annotate({
  description:
    "The exact CAIP-2 EVM chain ID, for example eip155:1 or eip155:11155111. Do not pass a chain name or bare numeric ID.",
});

const McpExecutionCall = Schema.Struct({
  to: EthereumAddress.annotate({
    description: "The EVM recipient or contract address for this call.",
  }),
  value: Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)).annotate({
    description:
      "Native currency value in wei as a base-10 integer string. Use 0 for calls that send no native currency.",
  }),
  data: Hex.annotate({
    description: "Hex-encoded EVM calldata. Use 0x for a plain native-currency transfer.",
  }),
}).annotate({
  identifier: "McpExecutionCall",
  description: "One exact EVM call to simulate or execute",
});

const McpTransactionFields = {
  namespace: Schema.Literal("eip155").annotate({
    description: "The wallet namespace. EVM operations use eip155.",
  }),
  walletId: McpWalletId,
  sessionKeyId: McpSessionKeyId,
  chainId: McpChainId,
  calls: Schema.Array(McpExecutionCall)
    .check(Schema.isMinLength(1, { message: "At least one call is required" }))
    .annotate({
      description:
        "The complete ordered call batch. The selected session key must authorize every call.",
    }),
};

export const McpGetWalletRequest = Schema.Struct({
  walletId: McpWalletId,
}).annotate({ identifier: "McpGetWalletRequest" });

export const McpListSessionKeysRequest = Schema.Struct({
  walletId: Schema.optionalKey(McpWalletId).annotate({
    description:
      "Optional wallet ID filter. Omit it to list every session key delegated to this authorization.",
  }),
}).annotate({ identifier: "McpListSessionKeysRequest" });

export const McpGetSessionKeyRequest = Schema.Struct({
  sessionKeyId: McpSessionKeyId,
}).annotate({ identifier: "McpGetSessionKeyRequest" });

export const McpExecuteTransactionRequest = Schema.Struct({
  ...McpTransactionFields,
  sponsor: Schema.optionalKey(Schema.Boolean).annotate({
    description:
      "Whether Namera should sponsor gas. Defaults to true. Set false only when the smart account should pay gas without consuming Namera sponsored-gas credits.",
  }),
}).annotate({
  identifier: "McpExecuteTransactionRequest",
  description:
    "An exact EVM transaction for a Namera wallet and its explicitly selected delegated session key.",
});

export const McpSimulateTransactionRequest = Schema.Struct(McpTransactionFields).annotate({
  identifier: "McpSimulateTransactionRequest",
  description:
    "An exact EVM transaction to simulate without signing, submitting, or sponsoring gas.",
});

const McpSignatureFields = {
  namespace: Schema.Literal("eip155").annotate({
    description: "The wallet namespace. EVM signatures use eip155.",
  }),
  walletId: McpWalletId,
  chainId: McpChainId,
};

const McpSignMessageRequest = Schema.Struct({
  ...McpSignatureFields,
  sessionKeyId: McpSessionKeyId,
  type: Schema.Literal("message"),
  message: Schema.String.annotate({
    description: "The exact UTF-8 message to sign. Do not hash or transform it first.",
  }),
}).annotate({ identifier: "McpSignMessageRequest" });

const McpSignTypedDataRequest = Schema.Struct({
  ...McpSignatureFields,
  sessionKeyId: McpSessionKeyId,
  type: Schema.Literal("typed-data"),
  typedData: EvmTypedData.annotate({
    description: "The complete EIP-712 typed-data object to sign.",
  }),
}).annotate({ identifier: "McpSignTypedDataRequest" });

const McpSignaturePayload = Schema.Union([McpSignMessageRequest, McpSignTypedDataRequest], {
  mode: "oneOf",
}).annotate({
  identifier: "McpSignaturePayload",
  description: "A message or EIP-712 typed-data signature request for a Namera wallet",
});

export const McpSignRequest = Schema.Struct({
  request: McpSignaturePayload.annotate({
    description: "The exact message or typed-data payload to sign.",
  }),
}).annotate({ identifier: "McpSignRequest" });

const McpVerifyMessageRequest = Schema.Struct({
  ...McpSignatureFields,
  type: Schema.Literal("message"),
  message: Schema.String.annotate({
    description: "The exact original UTF-8 message that was signed.",
  }),
  signature: Hex.annotate({ description: "The hex-encoded smart-account signature to verify." }),
}).annotate({ identifier: "McpVerifyMessageRequest" });

const McpVerifyTypedDataRequest = Schema.Struct({
  ...McpSignatureFields,
  type: Schema.Literal("typed-data"),
  typedData: EvmTypedData.annotate({
    description: "The complete original EIP-712 typed-data object that was signed.",
  }),
  signature: Hex.annotate({ description: "The hex-encoded smart-account signature to verify." }),
}).annotate({ identifier: "McpVerifyTypedDataRequest" });

const McpVerifySignaturePayload = Schema.Union(
  [McpVerifyMessageRequest, McpVerifyTypedDataRequest],
  { mode: "oneOf" },
).annotate({
  identifier: "McpVerifySignaturePayload",
  description: "The original payload and smart-account signature to verify",
});

export const McpVerifySignatureRequest = Schema.Struct({
  request: McpVerifySignaturePayload.annotate({
    description: "The original signed payload and the signature to verify.",
  }),
}).annotate({ identifier: "McpVerifySignatureRequest" });

export const McpGetTransactionStatusRequest = Schema.Struct({
  submissionId: ExecutionSubmissionId.annotate({
    description:
      "The submission ID returned by execute_transaction. Do not pass a transaction hash or execution ID.",
  }),
}).annotate({ identifier: "McpGetTransactionStatusRequest" });

export const McpGetExecutionsRequest = Schema.Struct({
  cursor: Schema.optionalKey(
    ExecutionId.annotate({
      description:
        "An execution ID returned as nextCursor by an earlier get_executions call. Omit it for the first page.",
    }),
  ),
}).annotate({ identifier: "McpGetExecutionsRequest" });

export const McpToolErrorCode = Schema.Literals([
  "NETWORK_PAUSED",
  "INVALID_ARGUMENT",
  "UNAUTHORIZED",
  "INSUFFICIENT_SCOPE",
  "WALLET_NOT_FOUND",
  "SESSION_KEY_NOT_FOUND",
  "EXECUTION_SUBMISSION_NOT_FOUND",
  "NO_AUTHORIZED_SESSION_KEY",
  "POLICY_DENIED",
  "IDEMPOTENCY_CONFLICT",
  "EXECUTION_FAILED",
  "EXECUTION_UNAVAILABLE",
  "SIGNING_FAILED",
  "SIGNATURE_UNAVAILABLE",
  "VERIFICATION_FAILED",
  "LIMIT_EXCEEDED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "LOCAL_SIGNER_REQUIRED",
  "LOCAL_SIGNER_UNAVAILABLE",
  "PREPARED_EXECUTION_INVALID",
  "PREPARED_SIGNATURE_INVALID",
  "LOCAL_SIGNATURE_INVALID",
]);

export const McpToolError = Schema.Struct({
  code: McpToolErrorCode,
  message: Schema.String,
  retryable: Schema.Boolean,
  policyId: Schema.optionalKey(PolicyId),
  policyCode: Schema.optionalKey(EvmPolicyDenialCode),
  retryAfterSeconds: Schema.optionalKey(Schema.Int),
}).annotate({
  identifier: "McpToolError",
  description: "A stable MCP tool failure with actionable recovery information",
});

export const McpToolErrorResponse = Schema.Struct({ error: McpToolError }).annotate({
  identifier: "McpToolErrorResponse",
});

export type McpToolError = typeof McpToolError.Type;
export type McpToolErrorCode = typeof McpToolErrorCode.Type;
