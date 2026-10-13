import { useCallback } from "react";

import { Button, Sidebar, useSidebar } from "@namera-ai/ui";
import { Comment01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

export function FeedbackSidebarFooter({ onOpen }: { onOpen: () => void }) {
  const { setMobileOpen } = useSidebar();
  const open = useCallback(() => {
    setMobileOpen(false);
    onOpen();
  }, [onOpen, setMobileOpen]);
  return (
    <Sidebar.Footer className="p-3">
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start gap-2 text-muted max-md:min-h-11"
        onPress={open}
      >
        <HugeiconsIcon icon={Comment01Icon} size={16} aria-hidden="true" />
        Feedback
      </Button>
    </Sidebar.Footer>
  );
}
