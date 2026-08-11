// oxlint-disable react-perf/jsx-no-new-array-as-prop
import { useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { IconPicker } from "@namera-ai/ui";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [value, setValue] = useState<MetadataIcon>({
    type: "emoji",
    value: "🎉",
  });

  return (
    <div className="p-4 w-full h-full">
      <IconPicker value={value} setValue={setValue} supportedTypes={["icon", "emoji", "image"]} />
    </div>
  );
}
