import { Button, Popover, Separator, Switch, Tooltip, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, LayoutThreeColumnIcon } from "@namera-ai/ui/icons";

type AssetViewOptionsProps = {
  readonly showTestnets: boolean;
  readonly onShowTestnetsChange: (showTestnets: boolean) => void;
};

export function AssetViewOptions({ showTestnets, onShowTestnetsChange }: AssetViewOptionsProps) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="inline-flex">
        <span className="inline-flex">
          <Popover>
            <Button
              isIconOnly
              aria-label="Configure asset view"
              className="rounded-full"
              size="sm"
              variant="tertiary"
            >
              <HugeiconsIcon icon={LayoutThreeColumnIcon} />
            </Button>
            <Popover.Content className="w-80 border-1 p-0" placement="bottom end">
              <Popover.Dialog className="outline-none">
                <div className="p-3">
                  <Popover.Heading className="text-sm font-medium">View options</Popover.Heading>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <Typography className="text-sm!" weight="medium">
                      Show testnets
                    </Typography>
                    <Typography className="mt-0.5 text-xs!" color="muted">
                      Include balances from supported test networks.
                    </Typography>
                  </div>
                  <Switch
                    aria-label="Show testnet assets"
                    isSelected={showTestnets}
                    size="sm"
                    onChange={onShowTestnetsChange}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        Configure view
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { AssetViewOptionsProps };
