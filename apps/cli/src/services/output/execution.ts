import type {
  CompleteExecutionResponse,
  GetExecutionSubmissionResponse,
  ExecutionDetailsResponse,
  ListExecutionsResponse,
  SimulateExecutionResponse,
  SignResponse,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";

import {
  collection,
  fields,
  humanize,
  named,
  network,
  networkName,
  section,
  type PrettyPrinter,
} from "./document.js";
import { accountHeading, listArrow } from "./style.js";

export const executionStatusView: PrettyPrinter<
  GetExecutionSubmissionResponse | CompleteExecutionResponse
> = (result, colors) =>
  [
    section(
      `Execution ${humanize(result.status).toLowerCase()}`,
      [
        ["Status", humanize(result.status)],
        ["Submission ID", result.submissionId],
        [
          "User operation",
          "userOperationHash" in result ? (result.userOperationHash ?? undefined) : undefined,
        ],
        ...(result.status === "confirmed" && "execution" in result
          ? ([
              ["Execution ID", result.execution.id],
              ["Network", network(result.execution.data.chainId)],
              ["Transaction", result.execution.data.transactionHash],
              ["Created", result.execution.createdAt],
            ] as const)
          : []),
      ],
      colors,
    ),
    ...(["reserved", "prepared", "submitted"].includes(result.status)
      ? [`Not confirmed yet. Check again with:\n  namera execution status ${result.submissionId}`]
      : []),
  ].join("\n\n");

const actorName = (actor: ExecutionDetailsResponse["actor"]): string => {
  switch (actor.type) {
    case "api-key":
      return `${actor.apiKey.metadata.name} (API Key)`;
    case "mcp":
      return `${actor.authorization.client.clientName} (MCP)`;
    case "cli":
      return `${actor.authorization.metadata.type === "cli" ? actor.authorization.metadata.deviceName : actor.authorization.client.clientName} (CLI)`;
    case "user":
      return `${actor.member.user.metadata.name ?? actor.member.user.email} (Dashboard)`;
  }
};

export const executionsView: PrettyPrinter<{
  readonly items: readonly ExecutionDetailsResponse[];
  readonly nextCursor: ListExecutionsResponse["nextCursor"];
}> = (result, colors) =>
  [
    collection(
      result.items,
      "confirmed execution",
      "confirmed executions",
      (item, useColors) =>
        `${accountHeading(named(item.wallet.metadata), useColors)}\n${fields(
          [
            ["Transaction Hash", item.execution.data.transactionHash],
            ["UserOp Hash", item.execution.data.userOperationHash],
            ["Network", networkName(item.execution.data.chainId)],
            ["Actor", actorName(item.actor)],
            ["Session key", item.sessionKey.metadata.name],
          ],
          useColors,
          0,
        )
          .split("\n")
          .map((line) => `${listArrow(useColors)} ${line}`)
          .join("\n")}`,
      colors,
    ),
    ...(result.nextCursor
      ? [`Next page:\n  namera execution list --cursor ${result.nextCursor}`]
      : []),
  ].join("\n\n");

export const simulationView: PrettyPrinter<SimulateExecutionResponse> = (result, colors) =>
  [
    section(
      "Execution simulation",
      [
        ["Policy decision", result.allowed ? "Allowed" : "Denied"],
        ["Calls", result.callsSucceeded ? "Succeeded" : "Failed"],
        ["Wallet ID", result.walletId],
        ["Account", result.account],
        ["Network", network(result.chainId)],
        ["Session key ID", result.allowed ? result.sessionKeyId : undefined],
        ["Denials", result.allowed ? undefined : result.denials],
      ],
      colors,
    ),
    section(
      "Simulation details",
      [
        ["Gas estimate", result.simulation.userOperation],
        ["Calls", result.simulation.calls],
      ],
      colors,
    ),
    "Simulation only. No transaction was submitted.",
  ].join("\n\n");

export const signatureView: PrettyPrinter<SignResponse> = (result, colors) =>
  section(
    "Signature created",
    [
      ["Type", result.type === "typed-data" ? "Typed data (EIP-712)" : "Message"],
      ["Account", result.account],
      ["Wallet ID", result.walletId],
      ["Network", network(result.chainId)],
      ["Signature", result.signature],
    ],
    colors,
  );

export const verificationView: PrettyPrinter<VerifySignatureResponse> = (result, colors) =>
  section(
    result.valid ? "Signature valid" : "Signature invalid",
    [
      ["Valid", result.valid],
      ["Account", result.account],
      ["Wallet ID", result.walletId],
      ["Network", network(result.chainId)],
      ["Type", humanize(result.type)],
    ],
    colors,
  );
