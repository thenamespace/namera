import type { MetadataIcon } from "@namera-ai/protocol/model";
import { IconPreview, Typography } from "@namera-ai/ui";

const fallbackIcon: MetadataIcon = { type: "emoji", value: "👤" };

type DisplayMetadata = {
  readonly image?: MetadataIcon;
  readonly logo?: MetadataIcon;
  readonly name?: string;
};

type MetadataDisplayProps = {
  fallbackName: string;
  metadata: DisplayMetadata;
};

export function MetadataDisplay({ fallbackName, metadata }: MetadataDisplayProps) {
  const name = metadata.name ?? fallbackName;
  const icon = metadata.image ?? metadata.logo ?? fallbackIcon;

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IconPreview size="xs" value={icon} />
      <Typography className="truncate text-sm! leading-[1.2]" weight="normal">
        {name}
      </Typography>
    </div>
  );
}

export type { DisplayMetadata, MetadataDisplayProps };
