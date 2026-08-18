import { Surface, Tooltip } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { CopyIconButton } from "@/components/copy-icon-button";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

type CopyableOAuthValueProps = {
  label: string;
  value: string;
};

function CopyableOAuthValue({ label, value }: CopyableOAuthValueProps) {
  const displayValue = value.length > 40 ? `${value.slice(0, 20)}…${value.slice(-12)}` : value;
  const handleCopySuccess = useEventCallback(() =>
    showSuccessToast({ title: `${label} copied to clipboard` }),
  );
  const handleCopyError = useEventCallback(() =>
    showErrorToast(undefined, { title: `Couldn’t copy ${label.toLowerCase()}` }),
  );

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Tooltip delay={300}>
        <Tooltip.Trigger className="min-w-0 cursor-help">
          <code className="text-content-secondary block truncate text-xs">{displayValue}</code>
        </Tooltip.Trigger>
        <Tooltip.Content className="max-w-sm break-all font-mono text-xs" showArrow>
          <Tooltip.Arrow />
          {value}
        </Tooltip.Content>
      </Tooltip>
      <CopyIconButton
        label={label}
        value={value}
        onCopyError={handleCopyError}
        onCopySuccess={handleCopySuccess}
      />
    </div>
  );
}

type OAuthClientDetailsProps = {
  clientId: string;
  redirectUri: string;
};

export function OAuthClientDetails({ clientId, redirectUri }: OAuthClientDetailsProps) {
  return (
    <Surface className="mt-3 overflow-hidden rounded-xl p-0" variant="secondary">
      <div className="divide-separator divide-y">
        <div className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-content-tertiary text-xs">Client ID</span>
          <CopyableOAuthValue label="Client ID" value={clientId} />
        </div>
        <div className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-content-tertiary text-xs">Redirect URI</span>
          <CopyableOAuthValue label="Redirect URI" value={redirectUri} />
        </div>
      </div>
    </Surface>
  );
}

export type { OAuthClientDetailsProps };
