// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { useLocation } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  ListBox,
  Modal,
  Select,
  TextArea,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useCreateFeedback } from "@/hooks/feedback";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { FeedbackFormSchema } from "./schema";

const categories = [
  { id: "general", label: "General feedback" },
  { id: "bug", label: "Report a bug" },
  { id: "feature_request", label: "Request a feature" },
] as const;

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const pathname = useLocation({ select: (location) => location.pathname });
  const form = useForm<typeof FeedbackFormSchema.Encoded, unknown, typeof FeedbackFormSchema.Type>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(FeedbackFormSchema)),
    defaultValues: { category: "general", message: "" },
  });
  const create = useCreateFeedback({
    onSuccess: () => {
      showSuccessToast({
        title: "Feedback sent",
        description: "Thanks for helping improve Namera.",
      });
      onClose();
    },
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t send feedback",
        description: "Your message is still here. Please try again.",
      }),
  });
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose();
      }}
    >
      <Modal.Backdrop isDismissable={!create.isPending}>
        <Modal.Container>
          <Modal.Dialog className="w-full sm:max-w-lg">
            <Modal.CloseTrigger isDisabled={create.isPending} />
            <Modal.Header>
              <Modal.Heading>Send feedback</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form
                id={id}
                noValidate
                onSubmit={form.handleSubmit((values) => {
                  if (create.isPending) return;
                  create.mutate({
                    payload: {
                      category: values.category,
                      data: { version: 1, message: values.message },
                      ...(pathname.length <= 500 ? { pagePath: pathname } : {}),
                    },
                  });
                })}
              >
                <FieldGroup>
                  <Controller
                    name="category"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel id={`${id}-category`} isRequired>
                          Category
                        </FieldLabel>
                        <Select
                          variant="secondary"
                          aria-labelledby={`${id}-category`}
                          selectedKey={field.value}
                          isDisabled={create.isPending}
                          isInvalid={fieldState.invalid}
                          onSelectionChange={(key) => field.onChange(key)}
                          onBlur={field.onBlur}
                        >
                          <Select.Trigger ref={field.ref}>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox items={categories}>
                              {(category) => (
                                <ListBox.Item id={category.id} textValue={category.label}>
                                  {category.label}
                                </ListBox.Item>
                              )}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                        <FieldError>{fieldState.error?.message}</FieldError>
                      </Field>
                    )}
                  />
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${id}-message`} isRequired>
                          Message
                        </FieldLabel>
                        <TextArea
                          {...field}
                          variant="secondary"
                          id={`${id}-message`}
                          rows={6}
                          maxLength={5000}
                          disabled={create.isPending}
                          aria-invalid={fieldState.invalid}
                          aria-describedby={`${id}-error`}
                          placeholder="What could we improve?"
                          className="w-full resize-y"
                        />
                        <FieldError id={`${id}-error`}>{fieldState.error?.message}</FieldError>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={create.isPending} onPress={onClose}>
                Cancel
              </Button>
              <Button type="submit" form={id} isDisabled={create.isPending}>
                {create.isPending ? "Sending…" : "Send feedback"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
