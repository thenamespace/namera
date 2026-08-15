import { Button, Chip, Surface, Tooltip, toast } from "@namera-ai/ui";
import { Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

type CopyableOAuthValueProps = {
  label: string;
  value: string;
};

function CopyableOAuthValue({ label, value }: CopyableOAuthValueProps) {
  const displayValue = value.length > 40 ? `${value.slice(0, 20)}…${value.slice(-12)}` : value;
  const copyValue = useEventCallback(() => {
    void navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.danger(`Couldn't copy ${label.toLowerCase()}`),
    );
  });

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
      <Button
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0"
        isIconOnly
        size="sm"
        type="button"
        variant="ghost"
        onPress={copyValue}
      >
        <HugeiconsIcon icon={Copy01Icon} />
      </Button>
    </div>
  );
}

type OAuthClientDetailsProps = {
  clientId: string;
  redirectUri: string;
  scopes: ReadonlyArray<string>;
};

const scopeLabels: Readonly<Record<string, string>> = {
  "mcp:read": "Read",
  "mcp:execute": "Execute",
  offline_access: "Offline access",
};

export function OAuthClientDetails({ clientId, redirectUri, scopes }: OAuthClientDetailsProps) {
  return (
    <Surface className="mt-6 overflow-hidden rounded-xl p-0" variant="secondary">
      <div className="divide-separator divide-y">
        <div className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-content-tertiary text-xs">Client ID</span>
          <CopyableOAuthValue label="Client ID" value={clientId} />
        </div>
        <div className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center sm:gap-3">
          <span className="text-content-tertiary text-xs">Access</span>
          <div className="flex flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <Chip key={scope} size="sm" variant="soft">
                {scopeLabels[scope] ?? scope}
              </Chip>
            ))}
          </div>
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
