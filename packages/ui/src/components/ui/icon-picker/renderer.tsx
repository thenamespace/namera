import type { MetadataIcon } from "@namera-ai/schema";

import { Image } from "@namera-ai/ui/components/ui/image";
import { cn } from "@namera-ai/ui/lib/utils";

import { iconMap } from "./data";
import { getEmojiBackgroundColor } from "./helpers";

export const IconRenderer = ({
  icon,
  ...rest
}: {
  icon: string;
} & React.ComponentPropsWithoutRef<"svg">) => {
  const IconComponent = iconMap[icon]?.icon;

  if (!IconComponent) {
    return null;
  }

  return <IconComponent data-slot="icon" {...rest} />;
};

type MetadataIconRendererProps = {
  value: MetadataIcon;
  className?: string;
  iconCls?: string;
  emojiCls?: string;
  imageCls?: string;
};

export const MetadataIconRenderer = ({
  value,
  className,
  iconCls,
  emojiCls,
  imageCls,
}: MetadataIconRendererProps) => {
  if (value.type === "icon") {
    return (
      <IconRenderer icon={value.value} className={cn(iconCls, className)} />
    );
  }

  if (value.type === "emoji") {
    const backgroundColor = getEmojiBackgroundColor(value.value, 0.1);
    return (
      <div
        className={cn(emojiCls, className, "flex items-center justify-center")}
        style={{
          backgroundColor,
        }}
      >
        {value.value}
      </div>
    );
  }

  return (
    <Image
      src={value.value}
      className={cn(imageCls, className)}
      layout="fullWidth"
    />
  );
};
