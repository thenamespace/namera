import { useCallback } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Input, Label, TextField } from "@thenamespace/uikit";

export function ImagePanel({
  value,
  setValue,
}: {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
}) {
  const imageUrl = value.type === "image" ? value.value : "";
  const handleChange = useCallback(
    (url: string) => setValue({ type: "image", value: url }),
    [setValue],
  );

  return (
    <div className="flex flex-col gap-4">
      <TextField type="url" value={imageUrl} onChange={handleChange}>
        <Label>Image URL</Label>
        <Input placeholder="https://example.com/image.png" />
      </TextField>
      {imageUrl ? (
        <div className="bg-muted/20 aspect-square max-h-72 overflow-hidden rounded-lg">
          <img alt="Preview" className="size-full object-cover" src={imageUrl} />
        </div>
      ) : null}
    </div>
  );
}
