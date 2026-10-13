// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Field, FieldError, FieldLabel } from "@namera-ai/ui";
import { HugeiconsIcon, PencilEdit02Icon } from "@namera-ai/ui/icons";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";

import { ArtworkReview } from "./artwork-review";
import { ArtworkSchema, artworkTypes, type ArtworkDraft, type ArtworkKind } from "./artwork-schema";
import { IdentityArtwork } from "./profile-artwork";
import { useArtworkSave } from "./use-artwork-save";

// Object URLs are external resources: create and revoke them with the selected file's lifetime.
function useImagePreview(file: File | null) {
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview;
}

function ArtworkPicker({
  kind,
  control,
  disabled,
}: {
  kind: ArtworkKind;
  control: Control<ArtworkDraft>;
  disabled: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <Controller
      name={kind}
      control={control}
      render={({ field }) => (
        <Field
          className={
            kind === "header"
              ? "absolute top-3 right-3"
              : "absolute inset-0 flex items-center justify-center"
          }
        >
          <FieldLabel className="sr-only" htmlFor={id}>
            Change {kind}
          </FieldLabel>
          <input
            id={id}
            type="file"
            accept={artworkTypes.join(",")}
            hidden
            tabIndex={-1}
            ref={(element) => {
              input.current = element;
              field.ref(element);
            }}
            name={field.name}
            onBlur={field.onBlur}
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) field.onChange(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label={`Change ${kind}`}
            isDisabled={disabled}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
            onPress={() => input.current?.click()}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={16} aria-hidden />
          </Button>
        </Field>
      )}
    />
  );
}

export function ArtworkEditor({
  wallet,
  label,
  texts,
  name,
  actionsContainer,
}: {
  wallet: WalletResponse;
  label: EnsLabel;
  texts: Readonly<Record<string, string>>;
  name: string;
  actionsContainer: HTMLDivElement | null;
}) {
  const id = useId();
  const form = useForm<ArtworkDraft>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ArtworkSchema)),
    defaultValues: { avatar: null, header: null },
    mode: "onChange",
  });
  const draft = useWatch({ control: form.control });
  const [savedFiles, setSavedFiles] = useState<ArtworkDraft>({ avatar: null, header: null });
  const [review, setReview] = useState<ArtworkDraft | null>(null);
  const avatar = useImagePreview(
    form.formState.errors.avatar ? savedFiles.avatar : (draft.avatar ?? savedFiles.avatar),
  );
  const header = useImagePreview(
    form.formState.errors.header ? savedFiles.header : (draft.header ?? savedFiles.header),
  );
  const save = useArtworkSave(wallet, label, (kind, file) => {
    setSavedFiles((current) => ({ ...current, [kind]: file }));
    form.resetField(kind);
  });
  const pending = save.progress !== null;
  const changed = Boolean(draft.avatar || draft.header);
  return (
    <>
      <form
        id={id}
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (!pending && changed) setReview(values);
        })}
      >
        <IdentityArtwork
          texts={texts}
          name={name}
          avatarPreview={avatar}
          headerPreview={header}
          avatarAction={
            <ArtworkPicker
              kind="avatar"
              control={form.control}
              disabled={pending || review !== null}
            />
          }
          headerAction={
            <ArtworkPicker
              kind="header"
              control={form.control}
              disabled={pending || review !== null}
            />
          }
        />
      </form>
      {changed && actionsContainer
        ? createPortal(
            <div className="grid justify-items-end gap-2">
              {form.formState.errors.avatar || form.formState.errors.header ? (
                <div className="grid gap-1 text-xs">
                  <FieldError>{form.formState.errors.avatar?.message}</FieldError>
                  <FieldError>{form.formState.errors.header?.message}</FieldError>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  isDisabled={pending}
                  onPress={() => {
                    form.reset();
                    setReview(null);
                  }}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  form={id}
                  size="sm"
                  isDisabled={pending || !form.formState.isValid}
                >
                  Save
                </Button>
              </div>
            </div>,
            actionsContainer,
          )
        : null}
      {review ? (
        <ArtworkReview
          wallet={wallet}
          name={name}
          draft={review}
          progress={save.progress}
          ready={save.ready}
          approvalError={save.approvalError}
          onRetryApproval={save.retryApproval}
          onCancel={() => setReview(null)}
          onConfirm={() => {
            void save.run(form.getValues()).then((success) => {
              if (success) setReview(null);
              else setReview(form.getValues());
              return success;
            });
          }}
        />
      ) : null}
    </>
  );
}
