import type { UpdateNotificationPreferenceRequest } from "@namera-ai/protocol/dto";

export type NotificationPreferenceInput = typeof UpdateNotificationPreferenceRequest.Encoded;

export interface NotificationPreferenceItem {
  readonly defaultValues: NotificationPreferenceInput;
  readonly description: string;
  readonly label: string;
}

export interface NotificationPreferenceSection {
  readonly heading: string;
  readonly preferences: ReadonlyArray<NotificationPreferenceItem>;
}

export const notificationPreferenceSections: ReadonlyArray<NotificationPreferenceSection> = [
  {
    heading: "Product updates",
    preferences: [
      {
        defaultValues: {
          organizationId: null,
          category: "product",
          topic: "announcements",
          channel: "email",
          enabled: true,
        },
        label: "Product announcements",
        description: "Get notified about major releases and platform updates.",
      },
      {
        defaultValues: {
          organizationId: null,
          category: "product",
          topic: "changelog",
          channel: "email",
          enabled: false,
        },
        label: "Changelogs",
        description: "Follow new features and improvements inside the app.",
      },
      {
        defaultValues: {
          organizationId: null,
          category: "product",
          topic: "newsletter",
          channel: "email",
          enabled: true,
        },
        label: "Newsletter & blog",
        description: "Receive occasional emails about product news and updates.",
      },
    ],
  },
  {
    heading: "Account & security",
    preferences: [
      {
        defaultValues: {
          organizationId: null,
          category: "account",
          topic: "activity",
          channel: "email",
          enabled: true,
        },
        label: "Account activity",
        description: "Get notified when a new sign-in or authentication event is detected.",
      },
      {
        defaultValues: {
          organizationId: null,
          category: "account",
          topic: "security",
          channel: "email",
          enabled: true,
        },
        label: "Security alerts",
        description: "Get notified about suspicious activity or important security events.",
      },
    ],
  },
  {
    heading: "Organization activity",
    preferences: [
      {
        defaultValues: {
          organizationId: null,
          category: "organization",
          topic: "invitations",
          channel: "email",
          enabled: true,
        },
        label: "Organization invitations",
        description: "Receive email when you are invited to an organization.",
      },
      {
        defaultValues: {
          organizationId: null,
          category: "organization",
          topic: "session-keys",
          channel: "email",
          enabled: true,
        },
        label: "Session keys",
        description: "Receive email when a session key is created.",
      },
    ],
  },
];
