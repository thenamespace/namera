import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
} from "react";

import type { UseChatHelpers } from "@ai-sdk/react";

import type { ChatUIMessage } from "@/app/api/chat";

export const AISearchContext = createContext<{
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  chat: UseChatHelpers<ChatUIMessage>;
} | null>(null);

export const useAISearchContext = () => {
  // biome-ignore lint/style/noNonNullAssertion: safe
  return useContext(AISearchContext)!;
};

export const useAIChatContext = () => {
  // biome-ignore lint/style/noNonNullAssertion: safe
  return useContext(AISearchContext)!.chat;
};
