import { Button, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon, type Wallet01Icon } from "@namera-ai/ui/icons";

/*
 * Shown in a list/table body when the resource has never been created — not the
 * same as "nothing matches your filter". A tidy centered column: an icon badge
 * that names the resource, one line of what it is, and the single action that
 * creates it (the one accent on the screen).
 */
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
  readonly onCreate: () => void;
  readonly title: string;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 px-6 py-16 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl border border-border bg-surface/60 text-foreground/70 shadow-sm"
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
          size="sm"
        >
          {description}
        </Typography.Paragraph>
      </div>

      <Button className="mt-1" onPress={onCreate}>
        <HugeiconsIcon icon={Add01Icon} />
        {actionLabel}
      </Button>
    </div>
  );
}
