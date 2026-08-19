// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Button, ItemCard, Modal, Typography } from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon, PencilEdit02Icon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { evmPolicyDefinitions, evmPolicyFormIds } from "./data";
import { EvmPolicyEditor } from "./policy-editor";
import { EvmPolicySummary } from "./summary";
import type { EvmPolicyInput } from "./types";

type EvmPolicyCardProps = {
  index: number;
  policy: EvmPolicyInput;
  onChange: (index: number, policy: EvmPolicyInput) => void;
  onRemove: (index: number) => void;
};

export function EvmPolicyCard({ index, policy, onChange, onRemove }: EvmPolicyCardProps) {
  const definition = evmPolicyDefinitions[policy.type];
  const formId = evmPolicyFormIds[policy.type];
  const handleSave = useEventCallback((nextPolicy: EvmPolicyInput) => onChange(index, nextPolicy));
  const handleRemove = useEventCallback(() => onRemove(index));

  return (
    <ItemCard className="rounded-lg" variant="outline">
      <ItemCard.Icon className="self-start">
        <HugeiconsIcon icon={definition.icon} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title>{definition.name}</ItemCard.Title>
        <ItemCard.Description>
          <EvmPolicySummary policy={policy} />
        </ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action className="self-start">
        <div className="flex items-center gap-1">
          <Modal>
            <Button
              isIconOnly
              aria-label={`Edit ${definition.name} policy`}
              size="sm"
              type="button"
              variant="tertiary"
            >
              <HugeiconsIcon icon={PencilEdit02Icon} />
            </Button>
            <Modal.Backdrop>
              <Modal.Container size="lg">
                <Modal.Dialog>
                  {({ close }) => (
                    <>
                      <Modal.CloseTrigger />
                      <Modal.Header>
                        <Modal.Heading>Edit {definition.name.toLowerCase()}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="grid max-h-[60vh] min-h-0 gap-5 overflow-y-auto">
                        <Typography.Paragraph color="muted" size="sm">
                          {definition.description}
                        </Typography.Paragraph>
                        <EvmPolicyEditor
                          formId={formId}
                          initialValue={policy}
                          type={policy.type}
                          onSave={(nextPolicy) => {
                            handleSave(nextPolicy);
                            close();
                          }}
                        />
                      </Modal.Body>
                      <Modal.Footer>
                        <Button type="button" variant="secondary" onPress={close}>
                          Cancel
                        </Button>
                        <Button form={formId} type="submit">
                          Save changes
                        </Button>
                      </Modal.Footer>
                    </>
                  )}
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
          <Button
            isIconOnly
            aria-label={`Remove ${definition.name} policy`}
            size="sm"
            type="button"
            variant="tertiary"
            onPress={handleRemove}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      </ItemCard.Action>
    </ItemCard>
  );
}
