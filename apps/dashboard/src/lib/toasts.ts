import { toast } from "@namera-ai/ui";

import { type FeedbackMessage, getErrorMessage } from "@/lib/error-messages";

export const showErrorToast = (error: unknown, fallback: FeedbackMessage): void => {
  const message = getErrorMessage(error, fallback);

  toast.danger(message.title, { description: message.description });
};

export const showSuccessToast = (message: FeedbackMessage): void => {
  toast.success(message.title, { description: message.description });
};
