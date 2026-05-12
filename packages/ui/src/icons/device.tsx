import {
  GoogleChromeLogoIcon,
  type IconProps,
  CompassIcon,
  FireIcon,
  AppleLogoIcon,
  AppWindowIcon,
  AndroidLogoIcon,
  MonitorIcon,
} from "@phosphor-icons/react";

type DeviceIconProps = IconProps & {
  browser: string;
  os: string;
};

export const DeviceIcon = ({ browser, os, ...props }: DeviceIconProps) => {
  const b = browser.toLowerCase();
  const o = os.toLowerCase();

  if (b.includes("chrome")) {
    return <GoogleChromeLogoIcon {...props} />;
  }

  if (b.includes("safari")) {
    return <CompassIcon {...props} />;
  }

  if (b.includes("edge")) {
    return <AppWindowIcon {...props} />;
  }

  if (b.includes("firefox")) return <FireIcon {...props} />;

  // 2. Fallback to Device Type based on OS
  if (o.includes("ios")) {
    return <AppleLogoIcon {...props} />;
  }

  if (o.includes("android")) {
    return <AndroidLogoIcon {...props} />;
  }

  return <MonitorIcon {...props} />;
};
