// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button, ItemCard, Modal, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import type { CreateSessionKeyFormInput } from "../types";
import { policyCatalog, policyDefinitions, type PolicyNamespace } from "./data";
import { TimeWindowPolicyEditor } from "./evm/time-window";

type SessionKeyPolicyInput = CreateSessionKeyFormInput["policies"][number];

const timeWindowFormId = "add-time-window-policy-form";

type PolicyDialogProps = {
  existingPolicyTypes: ReadonlyArray<SessionKeyPolicyInput["type"]>;
  namespace: PolicyNamespace | undefined;
  onAdd: (policy: SessionKeyPolicyInput) => void;
};

export function PolicyDialog({ existingPolicyTypes, namespace, onAdd }: PolicyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<SessionKeyPolicyInput["type"] | null>(null);
  const policies = namespace ? policyCatalog[namespace] : [];
  const selectedDefinition = selectedPolicy ? policyDefinitions[selectedPolicy] : null;
  const handleOpenChange = useEventCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setSelectedPolicy(null);
  });
  const handleBack = useEventCallback(() => setSelectedPolicy(null));
  const handleAdd = useEventCallback((policy: SessionKeyPolicyInput) => {
    onAdd(policy);
    handleOpenChange(false);
  });

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button isDisabled={!namespace} size="sm" type="button" variant="tertiary">
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

            {selectedPolicy ? (
              <>
                <Modal.Body className="grid gap-5">
                  <Typography.Paragraph color="muted" size="sm">
                    {selectedDefinition?.description}
                  </Typography.Paragraph>
                  {selectedPolicy === "evm.time-window" ? (
                    <TimeWindowPolicyEditor formId={timeWindowFormId} onSave={handleAdd} />
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="secondary" onPress={handleBack}>
                    Back
                  </Button>
                  <Button form={timeWindowFormId} type="submit">
                    Add policy
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <>
                <Modal.Body className="my-4 grid gap-2 px-0">
                  {policies.map((policy) => {
                    const isAdded = existingPolicyTypes.includes(policy.type);

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
                <Modal.Footer>
                  <Button type="button" variant="secondary" onPress={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
