import type { Key } from "react";
import { useCallback, useState } from "react";

import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, Modal, Tabs } from "@thenamespace/uikit";

import { EmojiPanel } from "./emoji-panel.js";
import { IconPanel } from "./icon-panel.js";
import { IconPreview } from "./icon-preview.js";
import { ImagePanel } from "./image-panel.js";

export type IconPickerType = MetadataIcon["type"];

export type IconPickerProps = {
  value: MetadataIcon;
  setValue: (value: MetadataIcon) => void;
  supportedTypes?: readonly [IconPickerType, ...IconPickerType[]];
  "aria-label"?: string;
};

const DEFAULT_TYPES = ["icon", "emoji", "image"] as const;
const TYPE_LABELS: Record<IconPickerType, string> = {
  icon: "Icons",
  emoji: "Emoji",
  image: "Image",
};

function defaultValue(type: IconPickerType): MetadataIcon {
  if (type === "icon") return { type, value: "home-01", color: "#3b82f6" };
  if (type === "emoji") return { type, value: "😀" };
  return { type, value: "" };
}

export function IconPicker({
  value,
  setValue,
  supportedTypes = DEFAULT_TYPES,
  "aria-label": ariaLabel = "Choose icon",
}: IconPickerProps) {
  const firstType = supportedTypes[0];
  const [draft, setDraft] = useState<MetadataIcon>(
    supportedTypes.includes(value.type) ? value : defaultValue(firstType),
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) setDraft(supportedTypes.includes(value.type) ? value : defaultValue(firstType));
    },
    [firstType, supportedTypes, value],
  );
  const handleTabChange = useCallback((key: Key) => {
    const type = String(key) as IconPickerType;
    setDraft((current) => (current.type === type ? current : defaultValue(type)));
  }, []);
  const handleSave = useCallback(() => setValue(draft), [draft, setValue]);

  return (
    <Modal onOpenChange={handleOpenChange}>
      <Button
        isIconOnly
        aria-label={ariaLabel}
        className="size-11 overflow-hidden p-0"
        variant="secondary"
      >
        <IconPreview value={value} />
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Choose an icon</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Tabs selectedKey={draft.type} onSelectionChange={handleTabChange}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Icon type">
                    {supportedTypes.map((type) => (
                      <Tabs.Tab id={type} key={type}>
                        {TYPE_LABELS[type]}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                {supportedTypes.includes("icon") ? (
                  <Tabs.Panel className="pt-4" id="icon">
                    <IconPanel setValue={setDraft} value={draft} />
                  </Tabs.Panel>
                ) : null}
                {supportedTypes.includes("emoji") ? (
                  <Tabs.Panel className="pt-4" id="emoji">
                    <EmojiPanel setValue={setDraft} value={draft} />
                  </Tabs.Panel>
                ) : null}
                {supportedTypes.includes("image") ? (
                  <Tabs.Panel className="pt-4" id="image">
                    <ImagePanel setValue={setDraft} value={draft} />
                  </Tabs.Panel>
                ) : null}
              </Tabs>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button
                isDisabled={draft.value.trim().length === 0}
                slot="close"
                onPress={handleSave}
              >
                Save
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
