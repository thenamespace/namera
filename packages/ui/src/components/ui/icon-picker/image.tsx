import type { MetadataIcon } from "@namera-ai/schema";

import { useMemo, useState } from "react";

import { Input } from "@namera-ai/ui/components/ui/input";

import { Button } from "../button";

type Props = {
  value: MetadataIcon;
  onDone: (imageSrc: string) => void;
};

export const ImagePickerComponent = ({ value, onDone }: Props) => {
  const [imgSrc, setImgSrc] = useState(
    value.type === "image" ? value.value : "",
  );
  const defaultImage = "https://placehold.co/512x512/262627/FFF?text=Image";

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
          value={imageSrc}
          onChange={(e) => {
            setImgSrc(e.target.value);
          }}
        />
        <Button
          className="min-w-20"
          size="lg"
          onClick={() => {
            onDone(imageSrc);
          }}
        >
          Save
        </Button>
      </div>
      <img
        className="border-input aspect-square w-full rounded-xl border-1"
        onError={(e) => {
          e.currentTarget.src = defaultImage;
        }}
        src={imageSrc}
      />
    </div>
  );
};
