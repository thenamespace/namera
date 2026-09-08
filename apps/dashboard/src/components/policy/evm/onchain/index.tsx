// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, Modal } from "@namera-ai/ui";

import {
  onchainPermissionCatalog,
  type OnchainPermissionInput,
  type OnchainPermissionType,
} from "./catalog";
import { OnchainPermissionEditor } from "./editor";

export { onchainPermissionCatalog, type OnchainPermissionInput } from "./catalog";

export function OnchainPermissionDialog({
  onAdd,
}: {
  onAdd: (permission: OnchainPermissionInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OnchainPermissionType | null>(null);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) setType(null);
  };
  return (
    <Modal isOpen={open} onOpenChange={changeOpen}>
      <Button type="button" variant="tertiary" size="sm">
        Add permission
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {type ? onchainPermissionCatalog[type].name : "Onchain permissions"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid max-h-[60vh] gap-3 overflow-y-auto">
              {type ? (
                <OnchainPermissionEditor
                  key={type}
                  type={type}
                  onSave={(permission) => {
                    onAdd(permission);
                    changeOpen(false);
                  }}
                />
              ) : (
                (Object.keys(onchainPermissionCatalog) as OnchainPermissionType[]).map((key) => (
                  <Button
                    key={key}
                    className="h-auto justify-start py-3 text-left"
                    variant="tertiary"
                    onPress={() => setType(key)}
                  >
                    <span className="grid gap-1">
                      <span>{onchainPermissionCatalog[key].name}</span>
                      <span className="text-muted text-xs font-normal whitespace-normal">
                        {onchainPermissionCatalog[key].description}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </Modal.Body>
            {type ? (
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => setType(null)}>
                  Back
                </Button>
              </Modal.Footer>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
