import {
  Activity02Icon,
  DashboardSquare01Icon,
  InboxIcon,
  Key01Icon,
  UserGroupIcon,
} from "@namera-ai/ui/icons";

export const navigationGroups = [
  {
    label: "Primary",
    items: [{ label: "Overview", href: "/", icon: DashboardSquare01Icon }],
  },
  {
    label: "Access",
    items: [
      { label: "Waitlist", href: "/waitlist", icon: InboxIcon },
      { label: "Invites", href: "/invites", icon: Key01Icon },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Team", href: "/team", icon: UserGroupIcon },
      { label: "Activity", href: "/activity", icon: Activity02Icon },
    ],
  },
] as const;

export type NavigationGroup = (typeof navigationGroups)[number];
