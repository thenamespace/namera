// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, ItemCard, Modal, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { evmPolicyCatalog, evmPolicyDefinitions, evmPolicyFormIds } from "./data";
import { EvmPolicyEditor } from "./policy-editor";
import type { EvmPolicyInput, EvmPolicyType } from "./types";

type EvmPolicyDialogProps = {
  existingPolicyTypes: ReadonlyArray<EvmPolicyType>;
  isDisabled?: boolean;
  onAdd: (policy: EvmPolicyInput) => void;
};

export function EvmPolicyDialog({
  existingPolicyTypes,
  isDisabled = false,
  onAdd,
}: EvmPolicyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<EvmPolicyType | null>(null);
  const selectedDefinition = selectedPolicy ? evmPolicyDefinitions[selectedPolicy] : null;
  const formId = selectedPolicy ? evmPolicyFormIds[selectedPolicy] : undefined;
  const handleOpenChange = useEventCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setSelectedPolicy(null);
  });
  const handleBack = useEventCallback(() => setSelectedPolicy(null));
  const handleAdd = useEventCallback((policy: EvmPolicyInput) => {
    onAdd(policy);
    handleOpenChange(false);
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button isDisabled={isDisabled} size="sm" type="button" variant="tertiary">
        <HugeiconsIcon icon={Add01Icon} />
        Add policy
      </Button>

      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{selectedDefinition?.name ?? "Add a policy"}</Modal.Heading>
            </Modal.Header>

            {selectedPolicy && formId ? (
              <>
                <Modal.Body className="grid max-h-[60vh] min-h-0 gap-5 overflow-y-auto">
                  <Typography.Paragraph color="muted" size="sm">
                    {selectedDefinition?.description}
                  </Typography.Paragraph>
                  <EvmPolicyEditor formId={formId} type={selectedPolicy} onSave={handleAdd} />
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="tertiary" onPress={handleBack}>
                    Back
                  </Button>
                  <Button form={formId} type="submit">
                    Add policy
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <Modal.Body className="my-4 grid gap-2 px-0">
                {evmPolicyCatalog.map((policy) => {
                  const isAdded =
                    policy.cardinality === "singleton" && existingPolicyTypes.includes(policy.type);

                  return (
                    <ItemCard className="rounded-lg" key={policy.type} variant="outline">
                      <ItemCard.Icon>
                        <HugeiconsIcon icon={policy.icon} />
                      </ItemCard.Icon>
                      <ItemCard.Content>
                        <ItemCard.Title>{policy.name}</ItemCard.Title>
                        <ItemCard.Description>{policy.description}</ItemCard.Description>
                      </ItemCard.Content>
                      <ItemCard.Action>
                        <Button
                          isDisabled={isAdded}
                          size="sm"
                          variant="tertiary"
                          onPress={() => setSelectedPolicy(policy.type)}
                        >
                          {isAdded ? "Added" : "Add"}
                        </Button>
                      </ItemCard.Action>
                    </ItemCard>
                  );
                })}
              </Modal.Body>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
