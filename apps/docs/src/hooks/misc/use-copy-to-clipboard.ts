import { useEffect, useState } from "react";

import { useCopyToClipboard as useCopyToClipboardHook } from "usehooks-ts";

export const useCopyToClipboard = () => {
  const [, copy] = useCopyToClipboardHook();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    copy(text).catch(console.error);
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return { copied, copy: handleCopy };
};
