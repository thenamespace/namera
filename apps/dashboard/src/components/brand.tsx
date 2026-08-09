import { Typography } from "@namera-ai/ui";

export function Brand() {
  return (
    <div className="flex items-center gap-3" translate="no">
      <span
        aria-hidden="true"
        className="bg-foreground text-background grid size-8 place-items-center rounded-lg font-mono text-sm font-semibold"
      >
        N
      </span>
      <Typography weight="semibold">Namera</Typography>
    </div>
  );
}
