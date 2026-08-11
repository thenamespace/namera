import { useEffect, useMemo, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { HugeiconsIcon } from "@thenamespace/uikit/icons";

import { iconMap } from "./data.js";
import { getEmojiBackgroundColor } from "./helpers.js";

export function IconPreview({ value }: { value: MetadataIcon }) {
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
    return <img alt="" className="size-full object-cover" src={value.value} />;
  }

  if (value.type === "emoji") {
    return (
      <span
        aria-hidden
        className="flex size-full items-center justify-center text-xl"
        style={emojiStyle}
      >
        {value.value}
      </span>
    );
  }

  const icon = iconMap[value.value]?.icon ?? iconMap["home-01"]?.icon;

  return icon ? (
    <HugeiconsIcon aria-hidden className="size-5" icon={icon} style={iconStyle} />
  ) : null;
}
