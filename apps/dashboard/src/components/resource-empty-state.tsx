import { Button, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon, type Wallet01Icon } from "@namera-ai/ui/icons";

// Use for resources not yet created, rather than empty filter results.
export function ResourceEmptyState({
  actionLabel,
  description,
  icon,
  onCreate,
  title,
}: {
  readonly actionLabel: string;
  readonly description: string;
  readonly icon: typeof Wallet01Icon;
  readonly onCreate?: (() => void) | undefined;
  readonly title: string;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 px-6 py-16 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-xl border border-border bg-surface/60 text-foreground/70 shadow-sm"
      >
        <HugeiconsIcon className="size-6" icon={icon} />
      </span>

      <div className="flex flex-col items-center gap-1.5">
        <Typography.Heading className="text-center text-base" level={2} weight="medium">
          {title}
        </Typography.Heading>
        <Typography.Paragraph
          className="max-w-xs text-center leading-relaxed text-balance"
          color="muted"
          size="xs"
        >
          {description}
        </Typography.Paragraph>
      </div>

      {onCreate ? (
        <Button className="mt-1" onPress={onCreate} size="sm">
          <HugeiconsIcon icon={Add01Icon} />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
