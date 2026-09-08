import type { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { Typography } from "@namera-ai/ui";

import { onchainPermissionCatalog } from "./catalog";

export function OnchainAuthorizationSummary({
  authorization,
}: {
  authorization: EvmSessionAuthorization;
}) {
  return (
    <div className="grid gap-3 text-sm">
      <div>
        <Typography.Paragraph size="xs" color="muted">
          Session signer
        </Typography.Paragraph>
        <Typography.Code className="break-all text-xs">
          {authorization.signerAddress}
        </Typography.Code>
      </div>
      <Typography.Paragraph size="xs" color="muted">
        {authorization.validAfter === 0
          ? "Available immediately"
          : `From ${new Date(authorization.validAfter * 1000).toLocaleString()}`}
        {" · Until "}
        {new Date(authorization.validUntil * 1000).toLocaleString()}
      </Typography.Paragraph>
      <ul className="grid gap-3">
        {authorization.permissions.map((permission, index) => (
          // Authorization permissions are immutable; their stored order is stable.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index} className="grid gap-1">
            <Typography.Paragraph size="sm">
              {onchainPermissionCatalog[permission.type].name}
            </Typography.Paragraph>
            {"address" in permission ? (
              <Typography.Code className="break-all text-xs">{permission.address}</Typography.Code>
            ) : null}
            {"functions" in permission ? (
              <Typography.Code className="break-all text-xs">
                {permission.functions.join(", ")}
              </Typography.Code>
            ) : null}
            {"allowance" in permission ? (
              <Typography.Paragraph size="xs" color="muted">
                Allowance: {permission.allowance.toString()} base units
              </Typography.Paragraph>
            ) : null}
            {"limit" in permission ? (
              <Typography.Paragraph size="xs" color="muted">
                Gas allowance: {permission.limit.toString()} wei
              </Typography.Paragraph>
            ) : null}
            {permission.type === "root" ? (
              <Typography.Paragraph size="xs" className="text-danger">
                Full account authority, including account management.
              </Typography.Paragraph>
            ) : null}
          </li>
        ))}
      </ul>
      <Typography.Paragraph size="xs" color="muted">
        {authorization.allowSignatures
          ? "Signature authority enabled. Execution limits and expiry do not constrain ERC-1271 signatures; uninstall to remove this authority."
          : "No onchain signature authority."}
      </Typography.Paragraph>
    </div>
  );
}
