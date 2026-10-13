import {
  DashboardSquare01Icon,
  Comment01Icon,
  InboxIcon,
  Key01Icon,
  SourceCodeIcon,
  UserGroupIcon,
} from "@namera-ai/ui/icons";

export const navigationGroups = [
  {
    label: "Primary",
    items: [
      { label: "Overview", href: "/", icon: DashboardSquare01Icon },
      { label: "Feedback", href: "/feedback", icon: Comment01Icon },
    ],
  },
  {
    label: "Access",
    items: [
      { label: "Waitlist", href: "/waitlist", icon: InboxIcon },
      { label: "Invites", href: "/invites", icon: Key01Icon },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Catalog", href: "/catalog", icon: InboxIcon },
      { label: "Interfaces", href: "/interface", icon: SourceCodeIcon },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Team", href: "/team", icon: UserGroupIcon }],
  },
] as const;

export type NavigationGroup = (typeof navigationGroups)[number];
