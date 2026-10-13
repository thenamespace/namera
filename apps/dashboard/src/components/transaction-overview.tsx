// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, type ComponentProps, type ReactNode } from "react";

import { Button, Modal, Typography } from "@namera-ai/ui";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";

export type TransactionOverviewProps = {
  isOpen: boolean;
  title: ReactNode;
  description?: ReactNode;
  rows: readonly { id: string; key: ReactNode; value: ReactNode }[];
  children?: ReactNode;
  /** Additional content above the action buttons, such as fees or a warning. */
  footer?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  confirmVariant?: ComponentProps<typeof Button>["variant"];
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  isConfirmDisabled?: boolean;
};

export function TransactionOverview({
  isOpen,
  title,
  description,
  rows,
  children,
  footer,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  isPending = false,
  isConfirmDisabled = false,
}: TransactionOverviewProps) {
  const descriptionId = useId();
  const handleOpenChange = (open: boolean) => {
    if (!open && !isPending) onCancel();
  };
  const handleConfirm = () => {
    if (!isPending && !isConfirmDisabled) onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Backdrop isDismissable={!isPending} isKeyboardDismissDisabled={isPending}>
        <Modal.Container>
          <Modal.Dialog
            className="w-full sm:max-w-xl"
            {...(description ? { "aria-describedby": descriptionId } : {})}
            aria-busy={isPending}
          >
            {!isPending ? <Modal.CloseTrigger /> : null}
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              {description ? (
                <Typography id={descriptionId} className="break-words text-sm text-muted">
                  {description}
                </Typography>
              ) : null}
            </Modal.Header>
            <Modal.Body className="grid gap-4">
              {rows.length > 0 ? (
                <DashboardCardRoot className="bg-default! shadow-none">
                  <DashboardCardContent>
                    {rows.map((row) => (
                      <DashboardCardRow key={row.id}>
                        <div className="text-sm text-muted">{row.key}</div>
                        <div className="min-w-0 break-words text-sm">{row.value}</div>
                      </DashboardCardRow>
                    ))}
                  </DashboardCardContent>
                </DashboardCardRoot>
              ) : null}
              {children}
              {footer}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={isPending} onPress={onCancel}>
                {cancelText}
              </Button>
              <Button
                variant={confirmVariant}
                isPending={isPending}
                isDisabled={isPending || isConfirmDisabled}
                onPress={handleConfirm}
              >
                {confirmText}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
