import { queryOptions } from "@tanstack/react-query";

import type { BetaInviteStatus } from "@namera-ai/protocol/model";

import { client, run } from "@/api/client";

export const PAGE_SIZE = 25;

export type InviteFilters = {
  readonly status?: BetaInviteStatus;
  readonly email?: string;
  readonly cursor?: string;
};

export const invitesQuery = (filters: InviteFilters) =>
  queryOptions({
    queryKey: ["invites", filters] as const,
    queryFn: () =>
      run(
        client.betaInvite.list({
          query: {
            limit: PAGE_SIZE,
            ...(filters.status === undefined ? {} : { status: filters.status }),
            ...(filters.email ? { email: filters.email } : {}),
            ...(filters.cursor ? { cursor: filters.cursor } : {}),
          },
        }),
      ),
  });

export type UserFilters = { readonly search?: string; readonly cursor?: string };

export const usersQuery = (filters: UserFilters) =>
  queryOptions({
    queryKey: ["users", filters] as const,
    queryFn: () =>
      run(
        client.adminUser.list({
          query: {
            limit: PAGE_SIZE,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.cursor ? { cursor: filters.cursor } : {}),
          },
        }),
      ),
  });

export type WaitlistFilters = {
  readonly status?: "pending" | "completed";
  readonly search?: string;
  readonly cursor?: string;
};

export const waitlistQuery = (filters: WaitlistFilters) =>
  queryOptions({
    queryKey: ["waitlist", filters] as const,
    queryFn: () =>
      run(
        client.adminWaitlist.list({
          query: {
            limit: PAGE_SIZE,
            ...(filters.status === undefined ? {} : { status: filters.status }),
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.cursor ? { cursor: filters.cursor } : {}),
          },
        }),
      ),
  });
