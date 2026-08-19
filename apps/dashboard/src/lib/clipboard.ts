import type { FeedbackMessage } from "@/lib/error-messages";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

export const writeClipboardText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const copyTextWithFeedback = async (
  value: string,
  messages: { readonly success: FeedbackMessage; readonly error: FeedbackMessage },
): Promise<boolean> => {
  const copied = await writeClipboardText(value);
  if (copied) showSuccessToast(messages.success);
  else showErrorToast(undefined, messages.error);
  return copied;
};
