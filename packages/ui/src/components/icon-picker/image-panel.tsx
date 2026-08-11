import { useCallback, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, Input, TextField } from "@thenamespace/uikit";

const IMAGE_PLACEHOLDER = "https://api.dicebear.com/10.x/glass/svg?seed=Namera";

function isValidImageUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

export function ImagePanel({
  value,
  setValue,
  onSave,
}: {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
  onSave: (value: MetadataIcon) => void;
}) {
  const imageUrl = value.type === "image" ? value.value : "";
  const [failedUrl, setFailedUrl] = useState<string>();
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const isValid = isValidImageUrl(imageUrl);
  const hasError = failedUrl === imageUrl;
  const previewUrl = isValid && !hasError ? imageUrl : IMAGE_PLACEHOLDER;
  const canSave = isValid && !hasError && loadedUrl === imageUrl;
  const handleChange = useCallback(
    (url: string) => setValue({ type: "image", value: url }),
    [setValue],
  );
  const handleError = useCallback(() => setFailedUrl(imageUrl), [imageUrl]);
  const handleLoad = useCallback(() => {
    if (previewUrl === imageUrl) setLoadedUrl(imageUrl);
  }, [imageUrl, previewUrl]);
  const handleSave = useCallback(
    () => onSave({ type: "image", value: imageUrl }),
    [imageUrl, onSave],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <TextField
          aria-label="Image URL"
          className="min-w-0 flex-1"
          type="url"
          value={imageUrl}
          onChange={handleChange}
        >
          <Input placeholder="https://example.com/image.png" />
        </TextField>
        <Button isDisabled={!canSave} onPress={handleSave}>
          Save
        </Button>
      </div>
      <div className="bg-muted/20 h-80 overflow-hidden rounded-lg">
        <img
          alt=""
          className="size-full object-cover"
          src={previewUrl}
          onError={handleError}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
}
