import {
  AndroidIcon,
  AppleIcon,
  ChromeIcon,
  Fire03Icon,
  HugeiconsIcon,
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

  if (normalizedOs.includes("mac") || normalizedOs.includes("ios")) {
    return <HugeiconsIcon icon={AppleIcon} {...props} />;
  }

  if (normalizedOs.includes("android")) {
    return <HugeiconsIcon icon={AndroidIcon} {...props} />;
  }

  return <HugeiconsIcon icon={MonitorDotIcon} {...props} />;
}
