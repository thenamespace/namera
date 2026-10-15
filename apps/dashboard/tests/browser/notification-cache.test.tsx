import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Schema } from "effect";
import { AtomRegistry } from "effect/reactivity";

import { NotificationId } from "@namera-ai/protocol";
import { ListNotificationsResponse, NotificationResponse } from "@namera-ai/protocol/dto";
import { afterEach, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import {
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../../src/hooks/notification";

vi.mock("../../src/env", () => ({
  env: { backendUrl: "https://api.example.test", environment: "test" },
}));
vi.mock("../../src/telemetry", async () => {
  const { Atom } = await import("effect/reactivity");
  return { dashboardRuntime: Atom.context() };
});

afterEach(() => vi.mocked(globalThis.fetch).mockClear());

function notification(id: NotificationId) {
  return Schema.decodeUnknownSync(NotificationResponse)({
    notification: {
      id,
      organizationId: null,
      actorId: null,
      type: "auth.new-sign-in",
      resourceType: "session",
      resourceId: "01950000-0000-7000-8000-000000000001",
      data: { version: 1, ipAddress: null, userAgent: null },
      idempotencyKey: id,
      correlationId: id,
      expiresAt: null,
      createdAt: new Date("2026-10-01T12:00:00Z"),
    },
    readAt: null,
    receivedAt: new Date("2026-10-01T12:00:00Z"),
  });
}

it("refreshes all loaded pages and unread count after read and archive mutations", async () => {
  const firstId = NotificationId.make("01950000-0000-7000-8000-000000000010");
  const secondId = NotificationId.make("01950000-0000-7000-8000-000000000011");
  let first = notification(firstId);
  let second = notification(secondId);
  let archived = false;
  const requests: string[] = [];
  const mutations: unknown[] = [];
  const registry = AtomRegistry.make({ scheduleTask, defaultIdleTTL: 30_000 });
  vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (
      (url.pathname === "/auth/notification/" || url.pathname === "/auth/notification") &&
      request.method === "GET"
    ) {
      const laterPage = url.searchParams.has("cursor");
      expect(url.searchParams.get("cursor")).toBe(laterPage ? firstId : null);
      return Response.json(
        Schema.encodeSync(ListNotificationsResponse)({
          items: laterPage ? (archived ? [] : [second]) : [first],
          nextCursor: laterPage ? null : firstId,
        }),
      );
    }
    if (url.pathname === "/auth/notification/unread-count")
      return Response.json({
        count: Number(first.readAt === null) + Number(!archived && second.readAt === null),
      });
    if (request.method === "POST") {
      if (url.pathname === "/auth/notification/mark-all-read") {
        first = { ...first, readAt: first.receivedAt };
        second = { ...second, readAt: second.receivedAt };
        return Response.json({ count: 1 });
      }
      const payload = await request.json();
      mutations.push(payload);
      expect(payload).toEqual({ notificationId: secondId });
      if (url.pathname === "/auth/notification/mark-read")
        second = { ...second, readAt: second.receivedAt };
      else if (url.pathname === "/auth/notification/archive") archived = true;
      else throw new Error(`Unexpected mutation ${url.pathname}`);
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected request ${request.method} ${url.pathname}`);
  });
  const view = await renderHook(
    () => ({
      first: useNotifications(),
      second: useNotifications(firstId),
      count: useUnreadNotificationCount(),
      read: useMarkNotificationRead(),
      archive: useArchiveNotification(),
      readAll: useMarkAllNotificationsRead(),
    }),
    {
      wrapper: ({ children }) => (
        <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>
      ),
    },
  );
  try {
    await expect.poll(() => view.result.current.first.data?.nextCursor).toBe(firstId);
    await expect
      .poll(() => view.result.current.second.data?.items[0]?.notification.id)
      .toBe(secondId);
    await expect.poll(() => view.result.current.count.data?.count).toBe(2);
    await view.act(() =>
      view.result.current.read.mutateAsync({ payload: { notificationId: secondId } }),
    );
    await expect.poll(() => view.result.current.second.data?.items[0]?.readAt).not.toBeNull();
    await expect.poll(() => view.result.current.count.data?.count).toBe(1);
    await view.act(() =>
      view.result.current.archive.mutateAsync({ payload: { notificationId: secondId } }),
    );
    await expect.poll(() => view.result.current.second.data?.items).toEqual([]);
    await expect.poll(() => view.result.current.count.data?.count).toBe(1);
    await view.act(() => view.result.current.readAll.mutateAsync());
    await expect.poll(() => view.result.current.count.data?.count).toBe(0);
    expect(mutations).toEqual([{ notificationId: secondId }, { notificationId: secondId }]);
    expect(
      requests.filter(
        (request) => request === "GET /auth/notification/" || request === "GET /auth/notification",
      ).length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      requests.filter((request) => request.includes(`cursor=${firstId}`)).length,
    ).toBeGreaterThanOrEqual(4);
  } finally {
    await view.unmount();
    registry.dispose();
  }
});
