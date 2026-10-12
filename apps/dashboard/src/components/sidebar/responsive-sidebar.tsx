import { useCallback, type PropsWithChildren } from "react";

import { Button, Sidebar, useSidebar } from "@namera-ai/ui";
import { Cancel01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

export function ResponsiveSidebar({ children }: PropsWithChildren) {
  const { setMobileOpen } = useSidebar();
  const closeMenu = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <>
      <Sidebar>{children}</Sidebar>
      <Sidebar.Mobile backdrop="opaque" className="dashboard-mobile-menu">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium">Menu</span>
          <Button isIconOnly variant="ghost" aria-label="Close menu" onPress={closeMenu}>
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </Button>
        </div>
        {children}
      </Sidebar.Mobile>
    </>
  );
}
