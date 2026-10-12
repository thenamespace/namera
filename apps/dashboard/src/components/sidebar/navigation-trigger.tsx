import { Button, Sidebar, useSidebar } from "@namera-ai/ui";
import { HugeiconsIcon, Menu01Icon } from "@namera-ai/ui/icons";

export function NavigationTrigger() {
  const { isMobile, isMobileOpen, toggleSidebar } = useSidebar();
  if (!isMobile) return <Sidebar.Trigger aria-label="Toggle sidebar" />;

  return (
    <Button
      variant="ghost"
      className="shrink-0 gap-2 px-2"
      aria-label="Open menu"
      aria-expanded={isMobileOpen}
      aria-haspopup="dialog"
      onPress={toggleSidebar}
    >
      <HugeiconsIcon icon={Menu01Icon} size={20} />
      Menu
    </Button>
  );
}
