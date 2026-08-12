import type { GetSessionResponse } from "@namera-ai/protocol/dto";
import { Button, Chip, ItemCard } from "@namera-ai/ui";
import {
  AndroidIcon,
  AppleIcon,
  ChromeIcon,
  Fire03Icon,
  HugeiconsIcon,
  LogoutSquare01Icon,
  MonitorDotIcon,
  SafariIcon,
  WindowsOldIcon,
  type HugeiconsProps,
} from "@namera-ai/ui/icons";

type DeviceIconProps = Omit<HugeiconsProps, "icon"> & {
  browser: string;
  os: string;
};

export function DeviceIcon({ browser, os, ...props }: DeviceIconProps) {
  const normalizedBrowser = browser.toLowerCase();
  const normalizedOs = os.toLowerCase();

  if (normalizedBrowser.includes("edge")) {
    return <HugeiconsIcon icon={WindowsOldIcon} {...props} />;
  }

  if (normalizedBrowser.includes("chrome")) {
    return <HugeiconsIcon icon={ChromeIcon} {...props} />;
  }

  if (normalizedBrowser.includes("safari")) {
    return <HugeiconsIcon icon={SafariIcon} {...props} />;
  }

  if (normalizedBrowser.includes("firefox")) {
    return <HugeiconsIcon icon={Fire03Icon} {...props} />;
  }

  if (normalizedOs.includes("macos") || normalizedOs.includes("ios")) {
    return <HugeiconsIcon icon={AppleIcon} {...props} />;
  }

  if (normalizedOs.includes("android")) {
    return <HugeiconsIcon icon={AndroidIcon} {...props} />;
  }

  return <HugeiconsIcon icon={MonitorDotIcon} {...props} />;
}

const getSessionDevice = (userAgent: string | null) => {
  const value = userAgent?.toLowerCase() ?? "";

  const browser = (() => {
    if (value.includes("edg/")) return "Edge";
    if (value.includes("firefox/")) return "Firefox";
    if (value.includes("chrome/") || value.includes("crios/")) return "Chrome";
    if (value.includes("safari/")) return "Safari";
    return "Browser";
  })();

  const os = (() => {
    if (value.includes("iphone") || value.includes("ipad")) return "iOS";
    if (value.includes("android")) return "Android";
    if (value.includes("mac os")) return "macOS";
    if (value.includes("windows")) return "Windows";
    if (value.includes("linux")) return "Linux";
    return "Unknown device";
  })();

  return { browser, os };
};

interface SessionCardProps {
  isCurrent?: boolean;
  session: GetSessionResponse;
}

export function SessionCard({ isCurrent = false, session }: SessionCardProps) {
  const device = getSessionDevice(session.userAgent);
  const label = `${device.browser} on ${device.os}`;

  return (
    <ItemCard className="group min-h-16 border" variant="default">
      <ItemCard.Icon>
        <DeviceIcon aria-hidden browser={device.browser} os={device.os} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title className="flex max-w-full items-center gap-2">
          <span className="truncate">{label}</span>
          {isCurrent ? (
            <Chip color="success" size="sm" variant="soft">
              Current
            </Chip>
          ) : null}
        </ItemCard.Title>
      </ItemCard.Content>
      <ItemCard.Action className="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Button aria-label={`Log out ${label}`} size="sm" type="button" variant="danger-soft">
          <HugeiconsIcon icon={LogoutSquare01Icon} />
          Log out
        </Button>
      </ItemCard.Action>
    </ItemCard>
  );
}
