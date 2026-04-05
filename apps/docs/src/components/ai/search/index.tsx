import { type PropsWithChildren, useMemo, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { ChatUIMessage } from "@/app/api/chat";

import { AISearchContext } from "./context";

export const AISearch = ({ children }: PropsWithChildren) => {
  const [open, setOpen] = useState(false);

  const chat = useChat<ChatUIMessage>({
    id: "search",
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AISearchContext
      value={useMemo(() => ({ chat, open, setOpen }), [chat, open])}
    >
      {children}
    </AISearchContext>
  );
};

export * from "./panel";
