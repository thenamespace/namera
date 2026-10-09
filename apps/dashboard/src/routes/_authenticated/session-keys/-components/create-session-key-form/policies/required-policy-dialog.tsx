import { Schema } from "effect";

// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Modal } from "@namera-ai/ui";
import { useForm, type UseFormReturn } from "react-hook-form";

import { OnchainSettings } from "../onchain-settings";
import { CreateSessionKeyFormSchema } from "../schema";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";

export function RequiredPolicyDialog({
  form,
  kind,
  onClose,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  kind: "networks" | "lifetime";
  onClose: () => void;
}) {
  const draft = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: form.getValues(),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const save = async () => {
    const fields =
      kind === "networks"
        ? (["onchain.chains"] as const)
        : (["onchain.validAfter", "onchain.validUntil"] as const);
    if (!(await draft.trigger([...fields]))) return;
    for (const field of fields) {
      form.setValue(field, draft.getValues(field), { shouldDirty: true, shouldValidate: true });
    }
    onClose();
  };

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog className="max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{kind === "networks" ? "Networks" : "Lifetime"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid max-h-[60vh] min-h-0 gap-4 overflow-y-auto">
              <OnchainSettings form={draft} kind={kind} />
            </Modal.Body>
            <Modal.Footer className="flex-wrap gap-2">
              <span className="mr-auto self-center text-xs text-muted">Enforced onchain</span>
              <Button type="button" variant="tertiary" onPress={onClose}>
                Cancel
              </Button>
              <Button type="button" onPress={() => void save()}>
                Save policy
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
