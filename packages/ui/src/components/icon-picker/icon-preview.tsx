import { useEffect, useMemo, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { cn } from "@thenamespace/uikit";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";

import { iconMap } from "./data.js";
import { getEmojiBackgroundColor } from "./helpers.js";

export type IconPreviewSize = "xs" | "sm" | "md" | "lg";

export type IconPreviewProps = {
  value: MetadataIcon;
  size?: IconPreviewSize;
  className?: string;
};

const PREVIEW_SIZE_CLASSES: Record<IconPreviewSize, string> = {
  xs: "size-5 rounded-sm text-xs",
  sm: "size-8 rounded-sm text-sm",
  md: "size-10 rounded-md text-base",
  lg: "size-12 rounded-lg text-lg",
};

const ICON_SIZE_CLASSES: Record<IconPreviewSize, string> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export function IconPreview({ value, size = "md", className }: IconPreviewProps) {
  const [emojiBackground, setEmojiBackground] = useState<string>();
  const emojiStyle = useMemo(() => ({ backgroundColor: emojiBackground }), [emojiBackground]);
  const iconStyle = useMemo(
    () => ({ color: value.type === "icon" ? value.color : undefined }),
    [value],
  );

  useEffect(() => {
    if (value.type === "emoji") {
      setEmojiBackground(getEmojiBackgroundColor(value.value, 0.16));
    }
  }, [value]);

  if (value.type === "image") {
    return (
      <img
        alt=""
        className={cn("shrink-0 object-cover", PREVIEW_SIZE_CLASSES[size], className)}
        src={value.value}
      />
    );
  }

  if (value.type === "emoji") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center",
          PREVIEW_SIZE_CLASSES[size],
          className,
        )}
        style={emojiStyle}
      >
        {value.value}
      </span>
    );
  }

  const icon = iconMap[value.value]?.icon ?? iconMap["home-01"]?.icon;

  return icon ? (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        PREVIEW_SIZE_CLASSES[size],
        className,
      )}
    >
      <HugeiconsIcon
        aria-hidden
        className={ICON_SIZE_CLASSES[size]}
        icon={icon}
        style={iconStyle}
      />
    </span>
  ) : null;
}
