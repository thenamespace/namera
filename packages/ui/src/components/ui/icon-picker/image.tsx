import type { MetadataIcon } from "@namera-ai/schema";

import { useMemo, useState } from "react";

import { Button } from "@namera-ai/ui/components/ui/button";
import { Image } from "@namera-ai/ui/components/ui/image";
import { Input } from "@namera-ai/ui/components/ui/input";

type Props = {
  value: MetadataIcon;
  onDone: (imageSrc: string) => void;
};

export const ImagePickerComponent = ({ value, onDone }: Props) => {
  const [imgSrc, setImgSrc] = useState(
    value.type === "image" ? value.value : "",
  );
  const defaultImage =
    "https://api.dicebear.com/9.x/glass/svg?backgroundColor=6a75e2";

  const imageSrc = useMemo(() => {
    if (imgSrc.trim() === "") return defaultImage;
    return imgSrc;
  }, [imgSrc]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center gap-2">
        <Input
          className="border-input"
          placeholder="Image URL"
          value={imgSrc}
          onChange={(e) => {
            setImgSrc(e.target.value);
          }}
        />
        <Button
          className="min-w-20"
          size="lg"
          onClick={() => {
            onDone(imgSrc);
          }}
        >
          Save
        </Button>
      </div>
      <Image
        className="border-input aspect-square w-full rounded-xl border-1"
        defaultImage={defaultImage}
        src={imageSrc}
        layout="fullWidth"
      />
    </div>
  );
};
