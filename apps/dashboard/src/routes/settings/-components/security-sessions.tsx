import { Schema } from "effect";

import { ListSessionsResponse } from "@namera-ai/protocol/dto";

import { HeadingGroup } from "@/components/heading-group";

import { SessionCard } from "./session-card";

const demoSessions = Schema.decodeUnknownSync(ListSessionsResponse)([
  {
    id: "0198c451-1139-7abc-8def-0123456789ab",
    userId: "0198c451-1139-7abc-8def-1123456789ab",
    activeOrganizationId: null,
    ipAddress: "103.87.24.19",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    expiresAt: new Date("2026-09-30T12:00:00.000Z"),
    revokedAt: null,
  },
  {
    id: "0198c451-1139-7abc-8def-2123456789ab",
    userId: "0198c451-1139-7abc-8def-1123456789ab",
    activeOrganizationId: null,
    ipAddress: "49.36.121.8",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    expiresAt: new Date("2026-09-28T08:30:00.000Z"),
    revokedAt: null,
  },
  {
    id: "0198c451-1139-7abc-8def-3123456789ab",
    userId: "0198c451-1139-7abc-8def-1123456789ab",
    activeOrganizationId: null,
    ipAddress: "152.58.14.210",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
    expiresAt: new Date("2026-09-24T17:15:00.000Z"),
    revokedAt: null,
  },
]);

const currentSessionId = demoSessions[0]?.id;

export function SecuritySessions() {
  return (
    <section aria-labelledby="sessions-heading">
      <HeadingGroup className="mb-4">
        <HeadingGroup.Title id="sessions-heading">Sessions</HeadingGroup.Title>
        <HeadingGroup.Description>
          Manage the browsers and devices signed in to your account.
        </HeadingGroup.Description>
      </HeadingGroup>
      <ul className="space-y-2">
        {demoSessions.map((session) => (
          <li key={session.id}>
            <SessionCard isCurrent={session.id === currentSessionId} session={session} />
          </li>
        ))}
      </ul>
    </section>
  );
}
