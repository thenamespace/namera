export const atomKeys = {
  auth: {
    me: ["auth", "me"] as const,
    sessions: ["auth", "sessions"] as const,
  },
  organization: {
    listUserOrgs: ["organization", "listUserOrgs"] as const,
  },
  userPreference: {
    get: ["userPreference", "get"] as const,
  },
  misc: {
    ipLocation: (ipAddress?: string) =>
      ["misc", "ipLocation", ipAddress ?? "current"] as const,
  },
};
